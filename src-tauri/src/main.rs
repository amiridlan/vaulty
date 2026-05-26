// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sync;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // SyncState must be managed before the setup hook runs
        .manage(sync::SyncState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            // Initialise the iroh P2P endpoint on Tauri's async runtime.
            // This is non-blocking — the app starts immediately; the endpoint
            // becomes available within a few seconds once relay registration completes.
            tauri::async_runtime::spawn(async move {
                sync::init_endpoint(handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sync::commands::generate_vault_keypair,
            sync::commands::verify_vault_identity,
            sync::commands::validate_sync_code,
            sync::commands::get_node_ticket,
            sync::commands::dial_peer,
            sync::commands::get_connected_peers,
            sync::commands::disconnect_peer,
            sync::commands::push_sync_data,
            sync::commands::reconnect_peer,
            sync::commands::add_revoked_peer,
            sync::commands::remove_revoked_peer,
            sync::commands::get_endpoint_ready,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
