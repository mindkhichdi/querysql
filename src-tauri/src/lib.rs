mod commands;
mod db;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::open_database,
            commands::open_postgres_database,
            commands::close_database,
            commands::get_schema,
            commands::execute_query,
            commands::fetch_table_page,
            commands::apply_row_changes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
