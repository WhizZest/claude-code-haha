use tauri::Manager;

#[tauri::command]
fn get_server_url() -> String {
    let port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "3456".to_string());
    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    format!("http://{}:{}", host, port)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![get_server_url])
        .setup(|app| {
            // Window is configured in tauri.conf.json
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
