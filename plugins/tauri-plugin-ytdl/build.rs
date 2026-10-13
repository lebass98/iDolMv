const COMMANDS: &[&str] = &["init", "search", "download", "cancel", "list_files", "open_file"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).android_path("android").build();
}
