use rusqlite::Connection;
use serde::Serialize;

use super::{assert_known_table, primary_key_columns, quote_ident, sql_value_to_json, table_columns};

#[derive(Serialize)]
pub struct TablePage {
    pub columns: Vec<String>,
    pub pk_columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total_rows: i64,
}

pub fn fetch_table_page(
    conn: &Connection,
    table: &str,
    limit: i64,
    offset: i64,
    sort_column: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<TablePage, String> {
    assert_known_table(conn, table)?;
    let pk_columns = primary_key_columns(conn, table)?;
    let uses_implicit_rowid = pk_columns == vec!["rowid".to_string()];

    let mut valid_columns = table_columns(conn, table)?;
    if uses_implicit_rowid {
        valid_columns.push("rowid".to_string());
    }

    let select_list = if uses_implicit_rowid {
        "rowid, *".to_string()
    } else {
        "*".to_string()
    };

    let total_rows: i64 = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM {}", quote_ident(table)),
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut sql = format!("SELECT {select_list} FROM {}", quote_ident(table));
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
    sql.push_str(" LIMIT ? OFFSET ?");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let column_names: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();
    let col_count = column_names.len();

    let mut rows = Vec::new();
    let mut result_rows = stmt
        .query(rusqlite::params![limit, offset])
        .map_err(|e| e.to_string())?;
    while let Some(row) = result_rows.next().map_err(|e| e.to_string())? {
        let mut out_row = Vec::with_capacity(col_count);
        for i in 0..col_count {
            let value_ref = row.get_ref(i).map_err(|e| e.to_string())?;
            out_row.push(sql_value_to_json(value_ref));
        }
        rows.push(out_row);
    }

    Ok(TablePage {
        columns: column_names,
        pk_columns,
        rows,
        total_rows,
    })
}
