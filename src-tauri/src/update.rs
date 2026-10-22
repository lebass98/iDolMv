//! 앱이 스스로 새 버전을 받아 설치하는 기능.
//!
//! 흐름: GitHub 릴리스에서 최신 버전을 묻는다 → 지금 깔린 버전과 견준다 → 새 버전이면
//! 설치 파일을 캐시 폴더에 내려받고 → 설치 화면을 띄운다.
//!
//! 창(JS)에는 CSP가 걸려 있어 api.github.com을 직접 부를 수 없으므로 확인·다운로드를 Rust가 맡는다.
//! 설치만 플랫폼이 다르다. 맥은 DMG를 열고, 윈도우는 설치 파일을 실행하고,
//! 안드로이드는 Kotlin 플러그인(plugin:ytdl|install_apk)이 패키지 설치 화면을 띄운다.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::log;

/// 릴리스를 올려 두는 저장소. 공개 저장소라 토큰 없이 읽힌다.
const REPO: &str = "lebass98/iDolMv";
/// GitHub API는 User-Agent가 없으면 403을 준다.
const UA: &str = concat!("IdolMV4K/", env!("CARGO_PKG_VERSION"));

/// 다운로드 취소 신호. 창에서 '나중에'를 누르면 켜진다.
#[derive(Default)]
pub struct UpdateCancel(pub AtomicBool);

/// 창에 넘겨주는 새 버전 정보
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppRelease {
    pub version: String,
    pub asset_url: String,
    pub asset_name: String,
    pub size: u64,
    pub notes: String,
    pub published_at: String,
}

#[derive(Deserialize)]
struct GhAsset {
    name: String,
    size: u64,
    browser_download_url: String,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    assets: Vec<GhAsset>,
}

/// 지금 깔려 있는 버전. 빌드할 때 Cargo.toml에서 박히므로 배포 빌드에서도 믿을 수 있다.
pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
pub fn app_version() -> String {
    current_version().to_string()
}

/// 이 플랫폼이 받아야 할 설치 파일 이름의 끝부분. (릴리스에 올리는 이름과 맞춰야 한다)
fn asset_suffix() -> &'static str {
    if cfg!(target_os = "android") {
        "-android.apk"
    } else if cfg!(target_os = "windows") {
        "-windows-setup.exe"
    } else {
        "-mac.dmg"
    }
}

/// 버전 비교. `1.10.0`이 `1.9.0`보다 높도록 점으로 끊어 숫자로 견준다.
/// 뒤에 붙은 꼬리표(1.2.0-beta.1)는 숫자가 아닌 부분부터 무시한다.
pub fn is_newer(candidate: &str, current: &str) -> bool {
    let parts = |v: &str| -> Vec<u64> {
        v.split('.')
            .map(|piece| {
                let digits: String = piece.chars().take_while(|c| c.is_ascii_digit()).collect();
                digits.parse().unwrap_or(0)
            })
            .collect()
    };
    let a = parts(candidate);
    let b = parts(current);
    for i in 0..a.len().max(b.len()) {
        let left = a.get(i).copied().unwrap_or(0);
        let right = b.get(i).copied().unwrap_or(0);
        if left != right {
            return left > right;
        }
    }
    false
}

/// GitHub에 최신 릴리스를 묻는다. 새 버전이 없으면 Ok(None).
/// 미리 보기(pre-release)는 `releases/latest`가 걸러 주므로 윈도우 CI가 올리는 태그는 걸리지 않는다.
#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<AppRelease>, String> {
    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
    let client = reqwest::Client::builder()
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|_| "인터넷에 연결하지 못했어요.".to_string())?;
    if res.status() == reqwest::StatusCode::NOT_FOUND {
        // 정식 릴리스가 아직 없으면 최신인 것으로 본다.
        // 왜 "최신"이라고 나오는지 알 수 있게 로그에는 남긴다 (pre-release만 있으면 여기로 온다).
        log(&app, "릴리스가 아직 없어서 비교할 새 버전이 없습니다.");
        return Ok(None);
    }
    if !res.status().is_success() {
        return Err(format!("최신 버전을 확인하지 못했어요. (HTTP {})", res.status()));
    }
    let release: GhRelease = res.json().await.map_err(|_| "릴리스 정보가 올바르지 않아요.".to_string())?;

    let version = release.tag_name.trim_start_matches('v').to_string();
    if !is_newer(&version, current_version()) {
        log(
            &app,
            format!("최신 버전입니다. (지금 {}, 릴리스 {version})", current_version()),
        );
        return Ok(None);
    }
    let suffix = asset_suffix();
    let asset = release
        .assets
        .into_iter()
        .find(|a| a.name.ends_with(suffix))
        .ok_or_else(|| format!("이 기기에 맞는 설치 파일({suffix})이 릴리스에 없어요."))?;

    log(&app, format!("새 버전 {version} 발견 ({})", asset.name));
    Ok(Some(AppRelease {
        version,
        asset_url: asset.browser_download_url,
        asset_name: asset.name,
        size: asset.size,
        notes: release.body.unwrap_or_default().trim().to_string(),
        published_at: release.published_at.unwrap_or_default(),
    }))
}

/// 내려받은 설치 파일을 두는 곳. 설치가 끝나거나 취소되면 지운다.
fn target_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // 파일 이름에 경로 구분자가 섞여 들어오지 않게 마지막 조각만 쓴다.
    let safe = name.rsplit(['/', '\\']).next().unwrap_or("update.bin");
    Ok(dir.join(safe))
}

/// 설치 파일을 내려받는다. 진행률은 `update://progress`(0~1)로 창에 보낸다.
/// 받다 만 파일이 남아 있으면 이어받지 않고 처음부터 다시 받는다.
#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    cancel: State<'_, UpdateCancel>,
    url: String,
    name: String,
    size: u64,
) -> Result<String, String> {
    let path = target_path(&app, &name)?;
    let _ = std::fs::remove_file(&path);
    cancel.0.store(false, Ordering::SeqCst);

    let client = reqwest::Client::builder()
        .user_agent(UA)
        .build()
        .map_err(|e| e.to_string())?;
    let mut res = client
        .get(&url)
        .send()
        .await
        .map_err(|_| "설치 파일을 받지 못했어요.".to_string())?;
    if !res.status().is_success() {
        return Err(format!("설치 파일을 받지 못했어요. (HTTP {})", res.status()));
    }
    // 리다이렉트 뒤에 크기를 못 받으면 릴리스에 적힌 크기로 대신 계산한다.
    let total = res.content_length().filter(|n| *n > 0).unwrap_or(size);

    use std::io::Write;
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    let mut written: u64 = 0;
    let mut last_sent = 0u8;
    loop {
        if cancel.0.load(Ordering::SeqCst) {
            drop(file);
            let _ = std::fs::remove_file(&path);
            return Err("취소됨".into());
        }
        let chunk = match res.chunk().await {
            Ok(Some(c)) => c,
            Ok(None) => break,
            Err(_) => {
                drop(file);
                let _ = std::fs::remove_file(&path);
                return Err("받는 중에 연결이 끊겼어요.".into());
            }
        };
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        written += chunk.len() as u64;
        if total > 0 {
            // 1%씩만 보낸다. 창을 쓸데없이 다시 그리지 않도록.
            let pct = ((written * 100) / total).min(100) as u8;
            if pct != last_sent {
                last_sent = pct;
                let _ = app.emit("update://progress", written as f64 / total as f64);
            }
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    log(&app, format!("설치 파일 내려받음: {}", path.display()));
    Ok(path.to_string_lossy().to_string())
}

/// 받는 중인 다운로드를 멈춘다.
#[tauri::command]
pub fn cancel_update(cancel: State<'_, UpdateCancel>) {
    cancel.0.store(true, Ordering::SeqCst);
}

/// 캐시에 남은 설치 파일을 치운다. (설치를 마쳤거나 취소한 뒤)
#[tauri::command]
pub fn clear_update(app: AppHandle, name: String) {
    if let Ok(path) = target_path(&app, &name) {
        let _ = std::fs::remove_file(path);
    }
}

/// 설치를 시작한다.
/// 맥은 DMG를 Finder로 열고(사용자가 앱을 응용 프로그램으로 끌어다 놓는다),
/// 윈도우는 설치 파일을 그대로 실행한다.
/// 안드로이드에서는 쓰지 않는다 — Kotlin 플러그인이 패키지 설치 화면을 띄운다.
#[tauri::command]
pub fn install_update(app: AppHandle, path: String) -> Result<(), String> {
    // 안드로이드에서는 Kotlin 플러그인이 설치를 맡으므로 이 함수가 쓰이지 않는다.
    let _ = (&app, &path);
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("설치 파일을 열 수 없어요: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        std::process::Command::new(&path)
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("설치 파일을 실행할 수 없어요: {e}"))?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        return Err("이 기기에서는 앱 안에서 설치할 수 없어요.".into());
    }
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        log(&app, "설치 파일을 열었습니다.");
        Ok(())
    }
}
