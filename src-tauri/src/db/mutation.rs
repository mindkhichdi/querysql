use rusqlite::Connection;
use serde::Deserialize;
use std::collections::HashMap;

use super::{assert_known_table, json_to_sql_value, quote_ident, table_columns};

#[derive(Deserialize)]
#[serde(tag = "kind")]
pub enum RowChange {
    #[serde(rename = "insert")]
    Insert {
        values: HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "update")]
    Update {
        pk: HashMap<String, serde_json::Value>,
        values: HashMap<String, serde_json::Value>,
    },
    #[serde(rename = "delete")]
    Delete { pk: HashMap<String, serde_json::Value> },
}

fn valid_columns_for(conn: &Connection, table: &str) -> Result<Vec<String>, String> {
    let mut cols = table_columns(conn, table)?;
    cols.push("rowid".to_string());
    Ok(cols)
}

pub(crate) fn check_columns(
    valid: &[String],
    keys: impl Iterator<Item = String>,
) -> Result<(), String> {
    for key in keys {
        if !valid.iter().any(|c| c == &key) {
            return Err(format!("Unknown column: {key}"));
        }
    }
    Ok(())
}

pub fn apply_row_changes(
    conn: &mut Connection,
    table: &str,
    changes: Vec<RowChange>,
) -> Result<(), String> {
    assert_known_table(conn, table)?;
    let valid_columns = valid_columns_for(conn, table)?;
    let quoted_table = quote_ident(table);

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for change in changes {
        match change {
            RowChange::Insert { values } => {
                check_columns(&valid_columns, values.keys().cloned())?;
                if values.is_empty() {
                    tx.execute(&format!("INSERT INTO {quoted_table} DEFAULT VALUES"), [])
                        .map_err(|e| e.to_string())?;
                    continue;
                }
                let cols: Vec<&String> = values.keys().collect();
                let col_list = cols
                    .iter()
                    .map(|c| quote_ident(c))
                    .collect::<Vec<_>>()
                    .join(", ");
                let placeholders = cols.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
                let sql =
                    format!("INSERT INTO {quoted_table} ({col_list}) VALUES ({placeholders})");
                let params: Vec<rusqlite::types::Value> = cols
                    .iter()
                    .map(|c| json_to_sql_value(&values[*c]))
                    .collect();
                tx.execute(&sql, rusqlite::params_from_iter(params))
                    .map_err(|e| e.to_string())?;
            }
            RowChange::Update { pk, values } => {
                check_columns(&valid_columns, values.keys().cloned())?;
                check_columns(&valid_columns, pk.keys().cloned())?;
                if values.is_empty() || pk.is_empty() {
                    return Err("Update requires both values and a primary key".to_string());
                }
                let set_cols: Vec<&String> = values.keys().collect();
                let set_clause = set_cols
                    .iter()
                    .map(|c| format!("{} = ?", quote_ident(c)))
                    .collect::<Vec<_>>()
                    .join(", ");
                let pk_cols: Vec<&String> = pk.keys().collect();
                let where_clause = pk_cols
                    .iter()
                    .map(|c| format!("{} = ?", quote_ident(c)))
                    .collect::<Vec<_>>()
                    .join(" AND ");
                let sql = format!("UPDATE {quoted_table} SET {set_clause} WHERE {where_clause}");
                let mut params: Vec<rusqlite::types::Value> = set_cols
                    .iter()
                    .map(|c| json_to_sql_value(&values[*c]))
                    .collect();
                params.extend(pk_cols.iter().map(|c| json_to_sql_value(&pk[*c])));
                let affected = tx
                    .execute(&sql, rusqlite::params_from_iter(params))
                    .map_err(|e| e.to_string())?;
                if affected == 0 {
                    return Err("Row to update was not found (it may have changed underneath you)".to_string());
                }
            }
            RowChange::Delete { pk } => {
                check_columns(&valid_columns, pk.keys().cloned())?;
                if pk.is_empty() {
                    return Err("Delete requires a primary key".to_string());
                }
                let pk_cols: Vec<&String> = pk.keys().collect();
                let where_clause = pk_cols
                    .iter()
                    .map(|c| format!("{} = ?", quote_ident(c)))
                    .collect::<Vec<_>>()
                    .join(" AND ");
                let sql = format!("DELETE FROM {quoted_table} WHERE {where_clause}");
                let params: Vec<rusqlite::types::Value> =
                    pk_cols.iter().map(|c| json_to_sql_value(&pk[*c])).collect();
                tx.execute(&sql, rusqlite::params_from_iter(params))
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    tx.commit().map_err(|e| e.to_string())
}
