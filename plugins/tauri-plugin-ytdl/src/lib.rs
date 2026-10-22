//! 안드로이드용 yt-dlp 플러그인
//!
//! 맥 앱은 번들한 yt-dlp 실행 파일을 Rust가 직접 실행하지만, 안드로이드에서는 맥용 실행 파일을
//! 쓸 수 없어서 youtubedl-android(파이썬+yt-dlp+ffmpeg+QuickJS 묶음)를 Kotlin에서 호출함.
//!
//! 화면(JS) → Rust 명령 → Kotlin(YtdlPlugin.kt)
//! 진행 상황은 화면이 넘겨준 Channel로 Kotlin이 바로 보냄

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    command,
    ipc::Channel,
    plugin::{Builder, PluginHandle, TauriPlugin},
    AppHandle, Runtime,
};
#[cfg(mobile)]
use tauri::Manager;

#[allow(dead_code)]
pub struct Ytdl<R: Runtime>(PluginHandle<R>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchArgs {
    query: String,
    count: u32,
    on_event: Channel<Value>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadReq {
    id: String,
    url: String,
    title: String,
    folder: String,
    container: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadArgs {
    #[serde(flatten)]
    req: DownloadReq,
    on_event: Channel<Value>,
}

#[cfg(mobile)]
fn run<R: Runtime>(app: &AppHandle<R>, cmd: &str, args: impl Serialize) -> Result<Value, String> {
    app.state::<Ytdl<R>>()
        .0
        .run_mobile_plugin::<Value>(cmd, args)
        .map_err(|e| e.to_string())
}

/// 데스크톱에서는 쓰지 않음 (맥은 번들한 yt-dlp를 Rust가 직접 실행)
#[cfg(not(mobile))]
fn run<R: Runtime>(_app: &AppHandle<R>, cmd: &str, _args: impl Serialize) -> Result<Value, String> {
    Err(format!("ytdl 플러그인 '{cmd}'은(는) 안드로이드 전용입니다"))
}

/// 엔진 준비 (최초 1회 압축 해제 + yt-dlp 최신 버전으로 업데이트)
#[command]
async fn init<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || run(&app, "init", serde_json::json!({})))
        .await
        .map_err(|e| e.to_string())?
}

/// 유튜브 검색 → 한 줄(JSON)씩 on_event로 전달
#[command]
async fn search<R: Runtime>(app: AppHandle<R>, query: String, count: u32, on_event: Channel<Value>) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || run(&app, "search", SearchArgs { query, count, on_event }))
        .await
        .map_err(|e| e.to_string())?
}

/// 다운로드 → 진행률·완료·실패를 on_event로 전달
#[command]
async fn download<R: Runtime>(app: AppHandle<R>, req: DownloadReq, on_event: Channel<Value>) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || run(&app, "download", DownloadArgs { req, on_event }))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
async fn cancel<R: Runtime>(app: AppHandle<R>, id: String) -> Result<Value, String> {
    run(&app, "cancel", serde_json::json!({ "id": id }))
}

/// 저장 폴더의 파일 이름 목록 (이미 받은 영상 확인용)
#[command]
async fn list_files<R: Runtime>(app: AppHandle<R>, folder: String) -> Result<Value, String> {
    run(&app, "listFiles", serde_json::json!({ "folder": folder }))
}

/// 받은 영상을 다른 앱(동영상 플레이어)으로 열기
#[command]
async fn open_file<R: Runtime>(app: AppHandle<R>, path: String) -> Result<Value, String> {
    run(&app, "openFile", serde_json::json!({ "path": path }))
}

/// 내려받은 APK로 패키지 설치 화면 띄우기 (앱 업데이트)
#[command]
async fn install_apk<R: Runtime>(app: AppHandle<R>, path: String) -> Result<Value, String> {
    run(&app, "installApk", serde_json::json!({ "path": path }))
}

/// '출처를 알 수 없는 앱 설치' 허용 화면 열기 (설치가 막혔을 때)
#[command]
async fn open_install_settings<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    run(&app, "openInstallSettings", serde_json::json!({}))
}

pub fn init_plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("ytdl")
        .invoke_handler(tauri::generate_handler![init, search, download, cancel, list_files, open_file, install_apk, open_install_settings])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin("com.local.ytdl", "YtdlPlugin")?;
                app.manage(Ytdl(handle));
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = (app, api);
            }
            Ok(())
        })
        .build()
}
