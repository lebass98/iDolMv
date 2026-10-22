mod chart;
mod circle;
mod artists;
mod search;
mod tools;
mod update;
mod ytdlp;

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// 진행 중인 다운로드의 프로세스 ID (취소용)
#[derive(Default)]
pub struct Running(pub Mutex<HashMap<String, u32>>);

/// 화면 오른쪽 아래 Status 로그 창으로 보냄
pub fn log(app: &AppHandle, msg: impl Into<String>) {
    let line = format!("[{}] {}", chrono::Local::now().format("%H:%M:%S"), msg.into());
    // 개발 중에는 터미널에도 남기고, 이벤트 전달 실패를 삼키지 않음
    eprintln!("{line}");
    if let Err(e) = app.emit("log://line", &line) {
        eprintln!("!! log://line emit 실패: {e}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        // 안드로이드: yt-dlp를 youtubedl-android(Kotlin)로 실행
        .plugin(tauri_plugin_ytdl::init_plugin())
        .manage(Running::default())
        .manage(update::UpdateCancel::default())
        .setup(|app| {
            // 번들에 넣은 도구 실행 권한 확인 (chmod +x)
            tools::ensure_executable(app.handle());
            // 도구를 못 찾으면 검색·다운로드가 전부 실패하므로 시작할 때 미리 알림
            match tools::paths(app.handle()) {
                Ok(t) => eprintln!("도구 준비됨: {}", t.ytdlp.display()),
                Err(e) => eprintln!("!! 도구를 찾을 수 없음: {e}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chart::fetch_chart,
            circle::fetch_circle,
            search::search_4k,
            ytdlp::start_download,
            ytdlp::cancel_download,
            ytdlp::reveal_in_finder,
            ytdlp::open_folder,
            ytdlp::downloaded_ids,
            ytdlp::default_download_dir,
            update::app_version,
            update::check_update,
            update::download_update,
            update::cancel_update,
            update::clear_update,
            update::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("앱 실행 중 오류");
}
