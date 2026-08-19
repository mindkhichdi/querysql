pub mod mutation;
pub mod pagination;
pub mod pg;
pub mod query;
pub mod schema;

use rusqlite::types::{Value as SqlValue, ValueRef};
use serde_json::Value as JsonValue;

/// A connection to a database of a specific dialect. Postgres's client
/// requires `&mut self` for every operation (it buffers protocol state
/// internally), which is why `AppState` always hands out `&mut DbConnection`
/// regardless of dialect - see `state.rs`.
pub enum DbConnection {
    Sqlite(rusqlite::Connection),
    Postgres(postgres::Client),
}

pub fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

pub fn sql_value_to_json(v: ValueRef) -> JsonValue {
    match v {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(i) => JsonValue::Number(i.into()),
        ValueRef::Real(f) => serde_json::Number::from_f64(f)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        ValueRef::Text(t) => JsonValue::String(String::from_utf8_lossy(t).to_string()),
        ValueRef::Blob(b) => JsonValue::String(format!("<blob:{} bytes>", b.len())),
    }
}

pub fn json_to_sql_value(v: &JsonValue) -> SqlValue {
    match v {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else if let Some(f) = n.as_f64() {
                SqlValue::Real(f)
            } else {
                SqlValue::Null
            }
        }
        JsonValue::String(s) => SqlValue::Text(s.clone()),
        _ => SqlValue::Null,
    }
}

/// Returns the primary key column names for a table, in key order.
/// If the table has no explicit primary key, falls back to the implicit
/// `rowid`, represented as a single pseudo-column named "rowid".
pub fn primary_key_columns(
    conn: &rusqlite::Connection,
    table: &str,
) -> Result<Vec<String>, String> {
    let sql = format!("PRAGMA table_info({})", quote_ident(table));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut pk_cols: Vec<(i64, String)> = Vec::new();
    let rows = stmt
        .query_map([], |row| {
            let pk: i64 = row.get("pk")?;
            let name: String = row.get("name")?;
            Ok((pk, name))
        })
        .map_err(|e| e.to_string())?;
    for r in rows {
        let (pk, name) = r.map_err(|e| e.to_string())?;
        if pk > 0 {
            pk_cols.push((pk, name));
        }
    }
    if pk_cols.is_empty() {
        return Ok(vec!["rowid".to_string()]);
    }
    pk_cols.sort_by_key(|(pk, _)| *pk);
    Ok(pk_cols.into_iter().map(|(_, name)| name).collect())
}

/// Returns the declared column names for a table (does not include rowid).
pub fn table_columns(conn: &rusqlite::Connection, table: &str) -> Result<Vec<String>, String> {
    let sql = format!("PRAGMA table_info({})", quote_ident(table));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>("name"))
        .map_err(|e| e.to_string())?;
    let mut cols = Vec::new();
    for r in rows {
        cols.push(r.map_err(|e| e.to_string())?);
    }
    Ok(cols)
}

/// Confirms `table` is a real table/view in this database, to guard
/// against SQL injection before interpolating it as an identifier.
pub fn assert_known_table(conn: &rusqlite::Connection, table: &str) -> Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name = ?1)",
            [table],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists {
        Ok(())
    } else {
        Err(format!("Unknown table: {table}"))
    }
}
