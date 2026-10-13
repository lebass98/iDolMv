//! 4K MV 다운로드 (영상+소리 분리 스트림을 ffmpeg로 병합)
//!
//! 프론트엔드 ←→ 백엔드 통신
//!   invoke("start_download", {req})   → 즉시 반환, 이후 이벤트로 진행 상황 전달
//!   event "download://progress"       { id, percent, speed, eta, stage }
//!   event "download://done"           { id, path }
//!   event "download://error"          { id, message }
//!
//! 큐(순차 다운로드)는 프론트엔드가 관리: done/error/취소가 오면 다음 항목을 시작

use crate::{log, tools, Running};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    id: String,
    url: String,
    title: String,
    folder: String,
    /// "mp4" | "mkv"
    container: String,
}

#[derive(Serialize, Clone)]
struct Progress {
    id: String,
    percent: f64,
    speed: String,
    eta: String,
    stage: String,
}

#[derive(Serialize, Clone)]
struct Done {
    id: String,
    path: String,
}

#[derive(Serialize, Clone)]
struct Failed {
    id: String,
    message: String,
}

#[tauri::command]
pub fn start_download(app: AppHandle, running: State<'_, Running>, req: DownloadRequest) -> Result<(), String> {
    let t = tools::paths(&app)?;
    std::fs::create_dir_all(&req.folder).map_err(|e| format!("저장 폴더를 만들 수 없음: {e}"))?;

    let container = if req.container == "mkv" { "mkv" } else { "mp4" };
    let mut cmd = tools::command(&t.ytdlp);
    cmd.args([
        "--no-playlist",
        "--no-quiet", // --print가 켜는 조용한 모드를 끔 (단계 표시용 줄 필요)
        "--newline",
        "--progress",
        "--no-simulate",
        // 끊기거나 403이 나면 그 자리에서 다시 시도
        "--retries",
        "10",
        "--fragment-retries",
        "10",
        "--retry-sleep",
        "http:exp=1:20",
        // 4K 이상 영상 + 최고 음질, 4K가 없으면 받을 수 있는 최고화질
        "-f",
        "bv*[height>=2160]+ba/bv*+ba/b",
        "-S",
        "res,fps",
        "--merge-output-format",
        container,
        "--progress-template",
        "download:PROG|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--print",
        "after_move:FILE|%(filepath)s",
    ])
    .arg("--ffmpeg-location")
    .arg(&t.ffmpeg)
    .arg("--js-runtimes")
    .arg(format!("deno:{}", t.deno.display()))
    .args(if cfg!(windows) { &["--remote-components", "ejs:github"][..] } else { &[][..] })
    .arg("-o")
    // 파일 이름에 영상 ID를 넣어 "이미 받은 영상" 확인에 사용
    .arg(format!("{}/%(title)s [%(id)s].%(ext)s", req.folder))
    .arg(&req.url)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("yt-dlp 실행 실패: {e}"))?;
    running.0.lock().unwrap().insert(req.id.clone(), child.id());
    log(&app, format!("⬇️ 다운로드 시작: {}", req.title));

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let id = req.id.clone();
    let title = req.title.clone();

    let err_buf = Arc::new(Mutex::new(String::new()));
    {
        let err_buf = err_buf.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if line.starts_with("ERROR:") {
                    *err_buf.lock().unwrap() = line;
                }
            }
        });
    }

    std::thread::spawn(move || {
        let mut file_path: Option<String> = None;
        let mut stream = 0;
        let mut stage = String::from("준비 중");
        let emit = |app: &AppHandle, percent: f64, speed: &str, eta: &str, stage: &str| {
            let _ = app.emit(
                "download://progress",
                Progress { id: id.clone(), percent, speed: speed.into(), eta: eta.into(), stage: stage.into() },
            );
        };

        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let line = line.trim();
            if let Some(rest) = line.strip_prefix("FILE|") {
                file_path = Some(rest.to_string());
            } else if let Some(rest) = line.strip_prefix("PROG|") {
                let p: Vec<&str> = rest.split('|').map(str::trim).collect();
                if p.len() >= 3 {
                    let pct = p[0].trim_end_matches('%').parse::<f64>().unwrap_or(0.0);
                    emit(&app, pct, p[1], p[2], &stage);
                }
            } else if line.starts_with("[download] Destination:") {
                stream += 1;
                stage = if stream == 1 { "4K 영상 받는 중".into() } else { "소리 받는 중".into() };
            } else if line.starts_with("[Merger]") {
                stage = "영상·소리 병합 중 (ffmpeg)".into();
                emit(&app, 100.0, "", "", &stage);
            }
        }

        let status = child.wait();
        let was_running = app.state::<Running>().0.lock().unwrap().remove(&id).is_some();
        if !was_running {
            log(&app, format!("⏹ 취소됨: {title}"));
            return;
        }

        match (status, file_path) {
            (Ok(s), Some(path)) if s.success() => {
                log(&app, format!("✅ 완료: {path}"));
                let _ = app.notification().builder().title("다운로드 완료").body(&title).show();
                let _ = app.emit("download://done", Done { id: id.clone(), path });
            }
            (Ok(s), _) => {
                let raw = err_buf.lock().unwrap().clone();
                let message = if raw.is_empty() {
                    format!("실패 (종료 코드 {})", s.code().unwrap_or(-1))
                } else {
                    raw.trim_start_matches("ERROR:").trim().to_string()
                };
                log(&app, format!("❌ 실패: {title} — {message}"));
                let _ = app.emit("download://error", Failed { id: id.clone(), message });
            }
            (Err(e), _) => {
                let _ = app.emit("download://error", Failed { id: id.clone(), message: e.to_string() });
            }
        }
    });
    Ok(())
}

/// 실시간 취소: yt-dlp와 그 아래 ffmpeg까지 종료
#[tauri::command]
pub fn cancel_download(running: State<'_, Running>, id: String) {
    if let Some(pid) = running.0.lock().unwrap().remove(&id) {
        #[cfg(windows)]
        {
            // /T: 자식 프로세스(ffmpeg)까지, /F: 강제 종료
            let _ = tools::command("taskkill").args(["/T", "/F", "/PID", &pid.to_string()]).status();
        }
        #[cfg(not(windows))]
        {
            let _ = Command::new("pkill").args(["-TERM", "-P", &pid.to_string()]).status();
            let _ = Command::new("kill").args(["-TERM", &pid.to_string()]).status();
        }
    }
}

#[tauri::command]
pub fn reveal_in_finder(path: String) {
    // 맥: Finder / 윈도우: 탐색기에서 파일 선택
    #[cfg(windows)]
    let _ = Command::new("explorer").arg(format!("/select,{}", path.replace('/', "\\"))).spawn();
    #[cfg(not(windows))]
    let _ = Command::new("open").args(["-R", &path]).spawn();
}

#[tauri::command]
pub fn open_folder(path: String) {
    let _ = std::fs::create_dir_all(&path);
    #[cfg(windows)]
    let _ = Command::new("explorer").arg(path.replace('/', "\\")).spawn();
    #[cfg(not(windows))]
    let _ = Command::new("open").arg(&path).spawn();
}

/// 기본 저장 경로: ~/Downloads/Idol_MVs
#[tauri::command]
pub fn default_download_dir(app: AppHandle) -> String {
    // 안드로이드: 공용 Download 폴더 (파일 앱·갤러리에서 바로 보임)
    if cfg!(target_os = "android") {
        return "/storage/emulated/0/Download/Idol_MVs".into();
    }
    app.path()
        .download_dir()
        .map(|p| p.join("Idol_MVs").to_string_lossy().to_string())
        .unwrap_or_else(|_| "~/Downloads/Idol_MVs".into())
}

#[derive(Deserialize)]
pub struct CheckItem {
    id: String,
    title: String,
}

/// 비교용: 소문자 + 글자·숫자만 남김 (yt-dlp가 바꾸는 특수문자 무시)
fn simplify(s: &str) -> String {
    s.chars().filter(|c| c.is_alphanumeric()).flat_map(|c| c.to_lowercase()).collect()
}

/// 저장 폴더에 이미 받은 영상의 ID 목록
///   1) 파일 이름에 "[영상ID]"가 있으면 확실히 일치
///   2) 예전 이름 형식("제목 [2160p]")은 제목으로 비교
#[tauri::command]
pub fn downloaded_ids(folder: String, items: Vec<CheckItem>) -> Vec<String> {
    const VIDEO_EXT: &[&str] = &["mp4", "mkv", "webm", "mov"];
    let Ok(dir) = std::fs::read_dir(&folder) else { return vec![] };
    let files: Vec<String> = dir
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|x| x.to_str())
                .is_some_and(|x| VIDEO_EXT.contains(&x.to_lowercase().as_str()))
        })
        .filter_map(|p| p.file_stem().map(|s| s.to_string_lossy().to_string()))
        .filter(|name| !name.starts_with("._"))
        .collect();

    items
        .into_iter()
        .filter(|it| {
            let tag = format!("[{}]", it.id);
            let title = simplify(&it.title);
            files.iter().any(|f| {
                f.contains(&tag) || {
                    // "제목 [2160p]" → 대괄호 앞부분이 제목과 같은지
                    let base = f.rsplit_once(" [").map(|(b, _)| b).unwrap_or(f);
                    !title.is_empty() && simplify(base) == title
                }
            })
        })
        .map(|it| it.id)
        .collect()
}
