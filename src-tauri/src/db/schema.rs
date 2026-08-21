use std::collections::HashSet;

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
    /// True when the column is the sole member of a unique index/constraint.
    /// Not set for primary-key columns (those are implied unique and get their
    /// own PK chip in the UI instead).
    pub unique: bool,
    pub default_value: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
}

/// One foreign key constraint. `columns` and `ref_columns` are positionally
/// paired (columns[i] references ref_columns[i]); almost always length 1.
#[derive(Serialize, Clone)]
pub struct ForeignKeyInfo {
    pub name: Option<String>,
    pub columns: Vec<String>,
    pub ref_table: String,
    pub ref_columns: Vec<String>,
    /// "CASCADE" | "RESTRICT" | "SET NULL" | "SET DEFAULT" | "NO ACTION"
    pub on_delete: String,
    pub on_update: String,
}

#[derive(Serialize, Clone)]
pub struct TableInfo {
    pub name: String,
    pub is_view: bool,
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
}

#[derive(Serialize, Clone, Default)]
pub struct SchemaInfo {
    pub tables: Vec<TableInfo>,
}

/// Flags each column that is the sole member of some unique index, skipping
/// primary-key columns (which already get their own PK chip). Shared by both
/// the SQLite and Postgres backends, which each build `indexes` differently
/// but agree on this shape.
pub fn mark_unique_columns(columns: &mut [ColumnInfo], indexes: &[IndexInfo]) {
    let single_col_unique: HashSet<&str> = indexes
        .iter()
        .filter(|idx| idx.unique && idx.columns.len() == 1)
        .map(|idx| idx.columns[0].as_str())
        .collect();
    for col in columns.iter_mut() {
        if !col.primary_key && single_col_unique.contains(col.name.as_str()) {
            col.unique = true;
        }
    }
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
        let mut columns = get_columns(conn, &name)?;
        let indexes = if kind == "table" {
            get_indexes(conn, &name)?
        } else {
            vec![]
        };
        mark_unique_columns(&mut columns, &indexes);
        let foreign_keys = if kind == "table" {
            get_foreign_keys(conn, &name)?
        } else {
            vec![]
        };
        tables.push(TableInfo {
            name,
            is_view: kind == "view",
            columns,
            indexes,
            foreign_keys,
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
                unique: false,
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

fn get_foreign_keys(conn: &Connection, table: &str) -> Result<Vec<ForeignKeyInfo>, String> {
    let sql = format!("PRAGMA foreign_key_list({})", quote_ident(table));
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows: Vec<(i64, String, String, String, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>("id")?,
                row.get::<_, String>("table")?,
                row.get::<_, String>("from")?,
                row.get::<_, String>("to")?,
                row.get::<_, String>("on_update")?,
                row.get::<_, String>("on_delete")?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut fks: Vec<ForeignKeyInfo> = Vec::new();
    for (id, ref_table, from_col, to_col, on_update, on_delete) in rows {
        match fks
            .iter_mut()
            .find(|fk: &&mut ForeignKeyInfo| fk.name == Some(id.to_string()))
        {
            Some(fk) => {
                fk.columns.push(from_col);
                fk.ref_columns.push(to_col);
            }
            None => fks.push(ForeignKeyInfo {
                name: Some(id.to_string()),
                columns: vec![from_col],
                ref_table,
                ref_columns: vec![to_col],
                on_delete,
                on_update,
            }),
        }
    }
    for fk in fks.iter_mut() {
        fk.name = None;
    }
    Ok(fks)
}
