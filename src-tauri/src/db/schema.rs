use rusqlite::Connection;
use serde::Serialize;

use super::quote_ident;

#[derive(Serialize, Clone)]
pub struct ColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub not_null: bool,
    pub primary_key: bool,
    pub default_value: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
}

#[derive(Serialize, Clone)]
pub struct TableInfo {
    pub name: String,
    pub is_view: bool,
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
}

#[derive(Serialize, Clone, Default)]
pub struct SchemaInfo {
    pub tables: Vec<TableInfo>,
}

pub fn get_schema(conn: &Connection) -> Result<SchemaInfo, String> {
    let mut stmt = conn
        .prepare(
            "SELECT name, type FROM sqlite_master \
             WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' \
             ORDER BY name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let names: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut tables = Vec::with_capacity(names.len());
    for (name, kind) in names {
        let columns = get_columns(conn, &name)?;
        let indexes = if kind == "table" {
            get_indexes(conn, &name)?
        } else {
            vec![]
        };
        tables.push(TableInfo {
            name,
            is_view: kind == "view",
            columns,
            indexes,
        });
    }

    Ok(SchemaInfo { tables })
}

fn get_columns(conn: &Connection, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let sql = format!("PRAGMA table_info({})", quote_ident(table));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ColumnInfo {
                name: row.get("name")?,
                type_name: row.get("type")?,
                not_null: row.get::<_, i64>("notnull")? != 0,
                primary_key: row.get::<_, i64>("pk")? != 0,
                default_value: row.get("dflt_value")?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut cols = Vec::new();
    for r in rows {
        cols.push(r.map_err(|e| e.to_string())?);
    }
    Ok(cols)
}

fn get_indexes(conn: &Connection, table: &str) -> Result<Vec<IndexInfo>, String> {
    let sql = format!("PRAGMA index_list({})", quote_ident(table));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let index_rows: Vec<(String, bool)> = stmt
        .query_map([], |row| {
            let name: String = row.get("name")?;
            let unique: i64 = row.get("unique")?;
            Ok((name, unique != 0))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut indexes = Vec::with_capacity(index_rows.len());
    for (name, unique) in index_rows {
        let info_sql = format!("PRAGMA index_info({})", quote_ident(&name));
        let mut info_stmt = conn.prepare(&info_sql).map_err(|e| e.to_string())?;
        let cols: Vec<String> = info_stmt
            .query_map([], |row| row.get::<_, String>("name"))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        indexes.push(IndexInfo {
            name,
            columns: cols,
            unique,
        });
    }
    Ok(indexes)
}
