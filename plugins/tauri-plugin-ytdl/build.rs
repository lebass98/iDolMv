const COMMANDS: &[&str] = &["init", "search", "probe", "playlist", "download", "cancel", "list_files", "open_file", "install_apk", "open_install_settings"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).android_path("android").build();
}
