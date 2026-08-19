use rusqlite::Connection;
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

use crate::db::{mutation, pagination, pg, query, schema, DbConnection};
use crate::state::AppState;

#[derive(Serialize)]
pub struct OpenDatabaseResult {
    pub id: String,
    pub path: String,
    pub name: String,
    pub kind: &'static str,
}

#[tauri::command]
pub fn open_database(state: State<AppState>, path: String) -> Result<OpenDatabaseResult, String> {
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let mut map = state.connections.lock().map_err(|e| e.to_string())?;
    map.insert(id.clone(), std::sync::Mutex::new(DbConnection::Sqlite(conn)));

    Ok(OpenDatabaseResult {
        id,
        path,
        name,
        kind: "sqlite",
    })
}

#[tauri::command]
pub fn open_postgres_database(
    state: State<AppState>,
    config: pg::PgConnectionConfig,
) -> Result<OpenDatabaseResult, String> {
    let client = pg::connect(&config)?;
    let id = Uuid::new_v4().to_string();
    let name = format!("{}@{}", config.database, config.host);
    let path = format!(
        "postgres://{}@{}:{}/{}",
        config.user, config.host, config.port, config.database
    );

    let mut map = state.connections.lock().map_err(|e| e.to_string())?;
    map.insert(
        id.clone(),
        std::sync::Mutex::new(DbConnection::Postgres(client)),
    );

    Ok(OpenDatabaseResult {
        id,
        path,
        name,
        kind: "postgres",
    })
}

#[tauri::command]
pub fn close_database(state: State<AppState>, id: String) -> Result<(), String> {
    let mut map = state.connections.lock().map_err(|e| e.to_string())?;
    map.remove(&id);
    Ok(())
}

#[tauri::command]
pub fn get_schema(state: State<AppState>, id: String) -> Result<schema::SchemaInfo, String> {
    state.with_connection(&id, |conn| match conn {
        DbConnection::Sqlite(c) => schema::get_schema(c),
        DbConnection::Postgres(c) => pg::get_schema(c),
    })
}

#[tauri::command]
pub fn execute_query(
    state: State<AppState>,
    id: String,
    sql: String,
) -> Result<query::QueryResult, String> {
    state.with_connection(&id, |conn| match conn {
        DbConnection::Sqlite(c) => query::execute_query(c, &sql),
        DbConnection::Postgres(c) => pg::execute_query(c, &sql),
    })
}

#[tauri::command]
pub fn fetch_table_page(
    state: State<AppState>,
    id: String,
    table: String,
    limit: i64,
    offset: i64,
    sort_column: Option<String>,
    sort_dir: Option<String>,
) -> Result<pagination::TablePage, String> {
    state.with_connection(&id, |conn| match conn {
        DbConnection::Sqlite(c) => pagination::fetch_table_page(
            c,
            &table,
            limit,
            offset,
            sort_column.as_deref(),
            sort_dir.as_deref(),
        ),
        DbConnection::Postgres(c) => pg::fetch_table_page(
            c,
            &table,
            limit,
            offset,
            sort_column.as_deref(),
            sort_dir.as_deref(),
        ),
    })
}

#[tauri::command]
pub fn apply_row_changes(
    state: State<AppState>,
    id: String,
    table: String,
    changes: Vec<mutation::RowChange>,
) -> Result<(), String> {
    state.with_connection(&id, |conn| match conn {
        DbConnection::Sqlite(c) => mutation::apply_row_changes(c, &table, changes),
        DbConnection::Postgres(c) => pg::apply_row_changes(c, &table, changes),
    })
}
