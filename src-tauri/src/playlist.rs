//! 유튜브 플레이리스트 주소 → 안에 든 영상 목록
//!
//! 목록만 빠르게 가져온다(--flat-playlist). 포맷을 보지 않으므로 4K인지는 여기서 알 수 없다.
//! 사용자가 목록에서 고른 영상만 search::probe_4k로 하나씩 확인한다.
//! (영상 하나 확인에 2초쯤 걸리므로 200곡을 전부 확인하지 않게 고르는 단계를 둔 것)

use crate::{log, tools};
use serde::Serialize;
use serde_json::Value;
use std::process::Stdio;
use tauri::AppHandle;

/// 채널 주소를 넣으면 수천 개가 나올 수 있어 앞에서 끊는다.
const MAX_ITEMS: usize = 300;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistItem {
    id: String,
    url: String,
    title: String,
    channel: String,
    duration: Option<f64>,
    thumbnail: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistInfo {
    title: String,
    items: Vec<PlaylistItem>,
    /// MAX_ITEMS에서 끊겼는지 (화면에서 안내)
    truncated: bool,
}

/// 플레이리스트(또는 영상 하나) 주소를 넣으면 영상 목록을 돌려준다.
#[tauri::command]
pub async fn fetch_playlist(app: AppHandle, url: String) -> Result<PlaylistInfo, String> {
    let url = url.trim().to_string();
    if url.is_empty() {
        return Err("플레이리스트 주소를 넣어 주세요.".into());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("http로 시작하는 주소를 넣어 주세요.".into());
    }

    let t = tools::paths(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        log(&app, format!("🎵 플레이리스트 불러오기: {url}"));

        let out = tools::command(&t.ytdlp)
            .args(["--flat-playlist", "-J", "--no-warnings", "--ignore-errors"])
            .args(["-I", &format!(":{MAX_ITEMS}")])
            .arg("--js-runtimes")
            .arg(format!("deno:{}", t.deno.display()))
            .args(if cfg!(windows) { &["--remote-components", "ejs:github"][..] } else { &[][..] })
            .arg(&url)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("yt-dlp 실행 실패: {e}"))?;

        if !out.status.success() {
            // yt-dlp가 남긴 ERROR: 줄을 그대로 보여 준다 (비공개·삭제된 목록 등)
            let err = String::from_utf8_lossy(&out.stderr);
            let reason = err
                .lines()
                .rev()
                .find(|l| l.contains("ERROR:"))
                .map(|l| l.split_once("ERROR:").map(|(_, m)| m.trim()).unwrap_or(l).to_string())
                .unwrap_or_else(|| "목록을 가져오지 못했어요.".to_string());
            log(&app, format!("⚠️ 플레이리스트: {reason}"));
            return Err(reason);
        }

        let root: Value = serde_json::from_slice(&out.stdout)
            .map_err(|_| "yt-dlp가 돌려준 목록을 읽지 못했어요.".to_string())?;

        // 플레이리스트면 entries에, 영상 하나면 자기 자신이 항목이 된다.
        let items: Vec<PlaylistItem> = match root["entries"].as_array() {
            Some(entries) => entries.iter().filter_map(to_item).collect(),
            None => to_item(&root).into_iter().collect(),
        };
        if items.is_empty() {
            return Err("목록에 받을 수 있는 영상이 없어요.".into());
        }

        let title = root["title"].as_str().unwrap_or("플레이리스트").to_string();
        log(&app, format!("🎵 {title}: {}개", items.len()));
        Ok(PlaylistInfo {
            title,
            truncated: items.len() >= MAX_ITEMS,
            items,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// --flat-playlist 항목 한 개 → PlaylistItem.
/// 비공개·삭제된 영상은 id가 없거나 제목이 "[Private video]"로 오므로 걸러낸다.
fn to_item(v: &Value) -> Option<PlaylistItem> {
    let id = v["id"].as_str()?.to_string();
    let title = v["title"].as_str().unwrap_or("제목 없음").to_string();
    if title.starts_with("[Private") || title.starts_with("[Deleted") || title.starts_with("[Unavailable") {
        return None;
    }
    // flat 목록의 url은 영상 주소다. 없으면 id로 만든다.
    let url = v["url"]
        .as_str()
        .or(v["webpage_url"].as_str())
        .map(String::from)
        .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={id}"));

    // flat 목록은 thumbnail 하나가 아니라 thumbnails 배열로 올 때가 많다.
    let thumbnail = v["thumbnail"].as_str().map(String::from).or_else(|| {
        v["thumbnails"]
            .as_array()
            .and_then(|list| list.last())
            .and_then(|t| t["url"].as_str())
            .map(String::from)
    });

    Some(PlaylistItem {
        id,
        url,
        title,
        channel: v["channel"]
            .as_str()
            .or(v["uploader"].as_str())
            .unwrap_or("")
            .to_string(),
        duration: v["duration"].as_f64(),
        thumbnail,
    })
}
