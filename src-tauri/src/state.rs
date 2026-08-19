use crate::db::DbConnection;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub connections: Mutex<HashMap<String, Mutex<DbConnection>>>,
}

impl AppState {
    /// Postgres's client requires `&mut self` even for reads (it buffers
    /// protocol state), so every connection is accessed mutably regardless
    /// of dialect.
    pub fn with_connection<T>(
        &self,
        id: &str,
        f: impl FnOnce(&mut DbConnection) -> Result<T, String>,
    ) -> Result<T, String> {
        let map = self.connections.lock().map_err(|e| e.to_string())?;
        let conn_mutex = map
            .get(id)
            .ok_or_else(|| format!("No open connection with id {id}"))?;
        let mut conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        f(&mut conn)
    }
}
