//! yt-dlp로 유튜브 검색 → 실제 4K(2160p 이상) 포맷이 있는 영상만 골라냄
//!
//! 검색 결과는 한 개씩 확인되는 대로 이벤트로 보냄 (전부 끝날 때까지 기다리지 않음)
//!   event "search://result"  { artist, video }

use crate::{log, tools};
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MvResult {
    id: String,
    url: String,
    title: String,
    channel: String,
    thumbnail: Option<String>,
    duration: Option<f64>,
    max_height: u32,
    fps: Option<f64>,
    /// 4K 영상 + 최고 음질 예상 크기 (바이트)
    est_size: Option<u64>,
    view_count: Option<u64>,
    like_count: Option<u64>,
    /// 업로드 날짜 "YYYYMMDD"
    upload_date: Option<String>,
}

#[derive(Serialize, Clone)]
struct ResultEvent {
    artist: String,
    video: MvResult,
}

/// artist 한 명 검색. 반환값 = 4K 영상 개수
#[tauri::command]
pub async fn search_4k(app: AppHandle, artist: String, query: String, count: u32) -> Result<u32, String> {
    let t = tools::paths(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let query = format!("ytsearch{}:{}", count.clamp(1, 20), query);
        log(&app, format!("🔎 검색: \"{query}\""));

        let mut child = Command::new(&t.ytdlp)
            .args(["-j", "--no-warnings", "--no-playlist", "--ignore-errors"])
            .arg("--js-runtimes")
            .arg(format!("deno:{}", t.deno.display()))
            .arg(&query)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("yt-dlp 실행 실패: {e}"))?;

        let mut found = 0;
        let mut checked = 0;
        for line in BufReader::new(child.stdout.take().unwrap()).lines().map_while(Result::ok) {
            let Ok(v) = serde_json::from_str::<Value>(&line) else { continue };
            checked += 1;
            if let Some(video) = to_4k_result(&v) {
                found += 1;
                let _ = app.emit("search://result", ResultEvent { artist: artist.clone(), video });
            }
        }
        let _ = child.wait();
        log(&app, format!("   {artist}: {checked}개 확인 → 4K {found}개"));
        Ok(found)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 포맷 목록에 height >= 2160 인 영상 스트림이 있을 때만 결과로 만듦
fn to_4k_result(v: &Value) -> Option<MvResult> {
    let formats = v["formats"].as_array()?;
    let is_video = |f: &&Value| f["vcodec"].as_str().is_some_and(|c| c != "none");
    let size = |f: &Value| f["filesize"].as_u64().or_else(|| f["filesize_approx"].as_u64());

    let best_video = formats
        .iter()
        .filter(is_video)
        .filter(|f| f["height"].as_u64().unwrap_or(0) >= 2160)
        .max_by_key(|f| (f["height"].as_u64().unwrap_or(0), size(f).unwrap_or(0)))?;

    let best_audio = formats
        .iter()
        .filter(|f| f["vcodec"].as_str() == Some("none") && f["acodec"].as_str().is_some_and(|c| c != "none"))
        .max_by(|a, b| a["abr"].as_f64().unwrap_or(0.0).total_cmp(&b["abr"].as_f64().unwrap_or(0.0)));

    let est_size = size(best_video).map(|vs| vs + best_audio.and_then(size).unwrap_or(0));

    Some(MvResult {
        id: v["id"].as_str()?.to_string(),
        url: v["webpage_url"].as_str()?.to_string(),
        title: v["title"].as_str().unwrap_or("제목 없음").to_string(),
        channel: v["channel"].as_str().or(v["uploader"].as_str()).unwrap_or("").to_string(),
        thumbnail: v["thumbnail"].as_str().map(String::from),
        duration: v["duration"].as_f64(),
        max_height: best_video["height"].as_u64().unwrap_or(2160) as u32,
        fps: best_video["fps"].as_f64(),
        est_size,
        view_count: v["view_count"].as_u64(),
        like_count: v["like_count"].as_u64(),
        upload_date: v["upload_date"].as_str().map(String::from),
    })
}
