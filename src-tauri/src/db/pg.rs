use std::collections::HashMap;
use std::time::Duration;

use native_tls::TlsConnector;
use postgres::config::SslMode;
use postgres::types::{ToSql, Type};
use postgres::{Client, Config, NoTls, SimpleQueryMessage};
use postgres_native_tls::MakeTlsConnector;
use serde::Deserialize;

use super::mutation::{check_columns, RowChange};
use super::pagination::TablePage;
use super::query::QueryResult;
use super::quote_ident;
use super::schema::{ColumnInfo, IndexInfo, SchemaInfo, TableInfo};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PgConnectionConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    /// "disable" | "prefer" | "require"
    pub ssl_mode: String,
    pub accept_invalid_certs: bool,
}

pub fn connect(cfg: &PgConnectionConfig) -> Result<Client, String> {
    let mut config = Config::new();
    config
        .host(&cfg.host)
        .port(cfg.port)
        .user(&cfg.user)
        .dbname(&cfg.database)
        .connect_timeout(Duration::from_secs(10));
    if !cfg.password.is_empty() {
        config.password(&cfg.password);
    }
    config.ssl_mode(match cfg.ssl_mode.as_str() {
        "disable" => SslMode::Disable,
        "require" => SslMode::Require,
        _ => SslMode::Prefer,
    });

    if cfg.ssl_mode == "disable" {
        config.connect(NoTls).map_err(|e| e.to_string())
    } else {
        let connector = TlsConnector::builder()
            .danger_accept_invalid_certs(cfg.accept_invalid_certs)
            .build()
            .map_err(|e| e.to_string())?;
        config
            .connect(MakeTlsConnector::new(connector))
            .map_err(|e| e.to_string())
    }
}

fn pg_assert_known_table(client: &mut Client, table: &str) -> Result<(), String> {
    let row = client
        .query_opt(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
            &[&table],
        )
        .map_err(|e| e.to_string())?;
    if row.is_some() {
        Ok(())
    } else {
        Err(format!("Unknown table: {table}"))
    }
}

fn pg_table_columns(client: &mut Client, table: &str) -> Result<Vec<String>, String> {
    let rows = client
        .query(
            "SELECT column_name FROM information_schema.columns \
             WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
            &[&table],
        )
        .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

fn pg_column_types(client: &mut Client, table: &str) -> Result<HashMap<String, String>, String> {
    let rows = client
        .query(
            "SELECT column_name, udt_name FROM information_schema.columns \
             WHERE table_schema = 'public' AND table_name = $1",
            &[&table],
        )
        .map_err(|e| e.to_string())?;
    Ok(rows
        .iter()
        .map(|r| (r.get::<_, String>(0), r.get::<_, String>(1)))
        .collect())
}

/// Returns the table's primary key columns, or an empty vec if it has none.
fn pg_primary_key_columns(client: &mut Client, table: &str) -> Result<Vec<String>, String> {
    let rows = client
        .query(
            "SELECT kcu.column_name FROM information_schema.table_constraints tc \
             JOIN information_schema.key_column_usage kcu \
               ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema \
             WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1 \
             ORDER BY kcu.ordinal_position",
            &[&table],
        )
        .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| r.get::<_, String>(0)).collect())
}

/// Falls back to every column as a composite identity when a table has no
/// primary key, since Postgres has no stable equivalent to SQLite's rowid
/// (ctid changes across updates/vacuums, so it isn't safe to key edits on).
fn identity_columns(client: &mut Client, table: &str) -> Result<Vec<String>, String> {
    let pk = pg_primary_key_columns(client, table)?;
    if !pk.is_empty() {
        return Ok(pk);
    }
    pg_table_columns(client, table)
}

fn parse_index_columns(indexdef: &str) -> Vec<String> {
    let Some(start) = indexdef.find('(') else {
        return vec![];
    };
    let Some(end) = indexdef.rfind(')') else {
        return vec![];
    };
    if end <= start {
        return vec![];
    }
    indexdef[start + 1..end]
        .split(',')
        .map(|s| s.trim().trim_matches('"').to_string())
        .collect()
}

pub fn get_schema(client: &mut Client) -> Result<SchemaInfo, String> {
    let table_rows = client
        .query(
            "SELECT table_name, table_type FROM information_schema.tables \
             WHERE table_schema = 'public' ORDER BY table_name",
            &[],
        )
        .map_err(|e| e.to_string())?;

    let names: Vec<(String, bool)> = table_rows
        .iter()
        .map(|r| (r.get::<_, String>(0), r.get::<_, String>(1) == "VIEW"))
        .collect();

    let mut tables = Vec::with_capacity(names.len());
    for (name, is_view) in names {
        let pk_cols = pg_primary_key_columns(client, &name)?;
        let column_rows = client
            .query(
                "SELECT column_name, udt_name, is_nullable, column_default \
                 FROM information_schema.columns \
                 WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
                &[&name],
            )
            .map_err(|e| e.to_string())?;
        let columns: Vec<ColumnInfo> = column_rows
            .iter()
            .map(|row| {
                let col_name: String = row.get(0);
                ColumnInfo {
                    primary_key: pk_cols.iter().any(|c| c == &col_name),
                    name: col_name,
                    type_name: row.get(1),
                    not_null: row.get::<_, String>(2) == "NO",
                    default_value: row.get(3),
                }
            })
            .collect();

        let indexes = if is_view {
            vec![]
        } else {
            let index_rows = client
                .query(
                    "SELECT indexname, indexdef FROM pg_indexes \
                     WHERE schemaname = 'public' AND tablename = $1",
                    &[&name],
                )
                .map_err(|e| e.to_string())?;
            index_rows
                .iter()
                .map(|row| {
                    let indexdef: String = row.get(1);
                    IndexInfo {
                        name: row.get(0),
                        unique: indexdef.starts_with("CREATE UNIQUE"),
                        columns: parse_index_columns(&indexdef),
                    }
                })
                .collect()
        };

        tables.push(TableInfo {
            name,
            is_view,
            columns,
            indexes,
        });
    }

    Ok(SchemaInfo { tables })
}

fn collect_simple_query_rows(
    messages: Vec<SimpleQueryMessage>,
) -> (Vec<String>, Vec<Vec<serde_json::Value>>, i64) {
    let mut columns: Vec<String> = vec![];
    let mut rows: Vec<Vec<serde_json::Value>> = vec![];
    let mut command_rows_affected: i64 = 0;

    for msg in messages {
        match msg {
            SimpleQueryMessage::Row(row) => {
                if columns.is_empty() {
                    columns = row.columns().iter().map(|c| c.name().to_string()).collect();
                }
                let out = (0..columns.len())
                    .map(|i| match row.get(i) {
                        Some(v) => serde_json::Value::String(v.to_string()),
                        None => serde_json::Value::Null,
                    })
                    .collect();
                rows.push(out);
            }
            SimpleQueryMessage::CommandComplete(n) => {
                command_rows_affected = n as i64;
            }
            _ => {}
        }
    }

    (columns, rows, command_rows_affected)
}

/// Runs arbitrary user SQL via the simple query protocol, which returns
/// every value as text and (unlike the extended/prepared protocol) doesn't
/// require us to know parameter or column types ahead of time.
pub fn execute_query(client: &mut Client, sql: &str) -> Result<QueryResult, String> {
    let start = std::time::Instant::now();
    let messages = client.simple_query(sql).map_err(|e| e.to_string())?;
    let (columns, rows, command_rows_affected) = collect_simple_query_rows(messages);
    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
    let rows_affected = if columns.is_empty() {
        command_rows_affected
    } else {
        rows.len() as i64
    };
    Ok(QueryResult {
        columns,
        rows,
        rows_affected,
        duration_ms,
    })
}

pub fn fetch_table_page(
    client: &mut Client,
    table: &str,
    limit: i64,
    offset: i64,
    sort_column: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<TablePage, String> {
    pg_assert_known_table(client, table)?;
    let pk_columns = identity_columns(client, table)?;
    let valid_columns = pg_table_columns(client, table)?;

    let total_rows: i64 = client
        .query_one(&format!("SELECT COUNT(*) FROM {}", quote_ident(table)), &[])
        .map_err(|e| e.to_string())?
        .get(0);

    let mut sql = format!("SELECT * FROM {}", quote_ident(table));
    if let Some(col) = sort_column {
        if !valid_columns.iter().any(|c| c == col) {
            return Err(format!("Unknown sort column: {col}"));
        }
        let dir = match sort_dir {
            Some("desc") => "DESC",
            _ => "ASC",
        };
        sql.push_str(&format!(" ORDER BY {} {}", quote_ident(col), dir));
    }
    // LIMIT/OFFSET are our own clamped i64s, not user text, so it's safe to
    // format them directly (the simple query protocol has no bind params).
    sql.push_str(&format!(" LIMIT {} OFFSET {}", limit.max(0), offset.max(0)));

    let messages = client.simple_query(&sql).map_err(|e| e.to_string())?;
    let (mut columns, rows, _) = collect_simple_query_rows(messages);
    if columns.is_empty() {
        columns = valid_columns;
    }

    Ok(TablePage {
        columns,
        pk_columns,
        rows,
        total_rows,
    })
}

fn json_to_pg_param(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        other => Some(other.to_string()),
    }
}

/// Every parameter is bound as TEXT and cast to the real column type in the
/// SQL itself (`$1::udt_name`). This is the standard way to send
/// dynamically-typed values through tokio-postgres's extended protocol:
/// binding params as their real target type would require knowing that
/// type client-side before `ToSql` can encode them, but declaring them all
/// as TEXT (via `prepare_typed`) sidesteps that entirely and lets Postgres
/// do the coercion at execution time via the cast.
fn exec_typed(
    tx: &mut postgres::Transaction<'_>,
    sql: &str,
    params: &[Option<String>],
) -> Result<u64, String> {
    let types = vec![Type::TEXT; params.len()];
    let stmt = tx.prepare_typed(sql, &types).map_err(|e| e.to_string())?;
    let param_refs: Vec<&(dyn ToSql + Sync)> =
        params.iter().map(|p| p as &(dyn ToSql + Sync)).collect();
    tx.execute(&stmt, &param_refs).map_err(|e| e.to_string())
}

pub fn apply_row_changes(
    client: &mut Client,
    table: &str,
    changes: Vec<RowChange>,
) -> Result<(), String> {
    pg_assert_known_table(client, table)?;
    let valid_columns = pg_table_columns(client, table)?;
    let column_types = pg_column_types(client, table)?;
    let quoted_table = quote_ident(table);
    let cast_of = |col: &str| -> String {
        column_types
            .get(col)
            .cloned()
            .unwrap_or_else(|| "text".to_string())
    };

    let mut tx = client.transaction().map_err(|e| e.to_string())?;

    for change in changes {
        match change {
            RowChange::Insert { values } => {
                check_columns(&valid_columns, values.keys().cloned())?;
                if values.is_empty() {
                    tx.execute(&format!("INSERT INTO {quoted_table} DEFAULT VALUES"), &[])
                        .map_err(|e| e.to_string())?;
                    continue;
                }
                let cols: Vec<&String> = values.keys().collect();
                let col_list = cols.iter().map(|c| quote_ident(c)).collect::<Vec<_>>().join(", ");
                let placeholders = cols
                    .iter()
                    .enumerate()
                    .map(|(i, c)| format!("${}::{}", i + 1, cast_of(c)))
                    .collect::<Vec<_>>()
                    .join(", ");
                let sql = format!("INSERT INTO {quoted_table} ({col_list}) VALUES ({placeholders})");
                let params: Vec<Option<String>> =
                    cols.iter().map(|c| json_to_pg_param(&values[*c])).collect();
                exec_typed(&mut tx, &sql, &params)?;
            }
            RowChange::Update { pk, values } => {
                check_columns(&valid_columns, values.keys().cloned())?;
                check_columns(&valid_columns, pk.keys().cloned())?;
                if values.is_empty() || pk.is_empty() {
                    return Err("Update requires both values and a primary key".to_string());
                }
                let set_cols: Vec<&String> = values.keys().collect();
                let pk_cols: Vec<&String> = pk.keys().collect();
                let mut idx = 1;
                let set_clause = set_cols
                    .iter()
                    .map(|c| {
                        let clause = format!("{} = ${}::{}", quote_ident(c), idx, cast_of(c));
                        idx += 1;
                        clause
                    })
                    .collect::<Vec<_>>()
                    .join(", ");
                let where_clause = pk_cols
                    .iter()
                    .map(|c| {
                        let clause = format!("{} = ${}::{}", quote_ident(c), idx, cast_of(c));
                        idx += 1;
                        clause
                    })
                    .collect::<Vec<_>>()
                    .join(" AND ");
                let sql = format!("UPDATE {quoted_table} SET {set_clause} WHERE {where_clause}");
                let mut params: Vec<Option<String>> =
                    set_cols.iter().map(|c| json_to_pg_param(&values[*c])).collect();
                params.extend(pk_cols.iter().map(|c| json_to_pg_param(&pk[*c])));
                let affected = exec_typed(&mut tx, &sql, &params)?;
                if affected == 0 {
                    return Err(
                        "Row to update was not found (it may have changed underneath you)"
                            .to_string(),
                    );
                }
            }
            RowChange::Delete { pk } => {
                check_columns(&valid_columns, pk.keys().cloned())?;
                if pk.is_empty() {
                    return Err("Delete requires a primary key".to_string());
                }
                let pk_cols: Vec<&String> = pk.keys().collect();
                let mut idx = 1;
                let where_clause = pk_cols
                    .iter()
                    .map(|c| {
                        let clause = format!("{} = ${}::{}", quote_ident(c), idx, cast_of(c));
                        idx += 1;
                        clause
                    })
                    .collect::<Vec<_>>()
                    .join(" AND ");
                let sql = format!("DELETE FROM {quoted_table} WHERE {where_clause}");
                let params: Vec<Option<String>> =
                    pk_cols.iter().map(|c| json_to_pg_param(&pk[*c])).collect();
                exec_typed(&mut tx, &sql, &params)?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())
}
