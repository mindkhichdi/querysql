use rusqlite::Connection;
use serde::Serialize;
use std::time::Instant;

use super::sql_value_to_json;

#[derive(Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: i64,
    pub duration_ms: f64,
}

pub fn execute_query(conn: &Connection, sql: &str) -> Result<QueryResult, String> {
    let start = Instant::now();
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let column_names: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();

    if column_names.is_empty() {
        let rows_affected = stmt.execute([]).map_err(|e| e.to_string())? as i64;
        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
        return Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected,
            duration_ms,
        });
    }

    let col_count = column_names.len();
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut result_rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = result_rows.next().map_err(|e| e.to_string())? {
        let mut out_row = Vec::with_capacity(col_count);
        for i in 0..col_count {
            let value_ref = row.get_ref(i).map_err(|e| e.to_string())?;
            out_row.push(sql_value_to_json(value_ref));
        }
        rows.push(out_row);
    }
    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
    let rows_affected = rows.len() as i64;

    Ok(QueryResult {
        columns: column_names,
        rows,
        rows_affected,
        duration_ms,
    })
}
