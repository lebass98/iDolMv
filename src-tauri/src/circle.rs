//! 써클차트 디지털 차트 (곡 단위, 최대 200위)
//!
//! 1) 차트 페이지를 열어 현재 기준값(hitYear, targetTime, yearTime)을 읽음
//!      /page_chart/onoff.circle?serviceGbn=ALL&termGbn=week|month|year
//!      → var targetTime = "40";  (주간=주차, 월간=월, 연간=연도 뒤 두 자리)
//! 2) 페이지가 내부적으로 쓰는 데이터 주소에 같은 값으로 POST
//!      /data/api/chart/onoff  → { List: { "1": {SERVICE_RANKING, SONG_NAME, ARTIST_NAME, ...} } }

use crate::{artists, log};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;

const BASE: &str = "https://circlechart.kr";
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
    (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SongEntry {
    rank: u32,
    song: String,
    artist: String,
    album: String,
    image: Option<String>,
    /// 지난 순위 대비 변동 ("up" | "down" | "same" | "new")
    rank_status: String,
    rank_change: i32,
    genre: artists::Genre,
    /// 유튜브 검색용 가수 이름
    search_artist: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SongChart {
    entries: Vec<SongEntry>,
    /// 예: "2026년 40주차"
    label: String,
    fetched_at: String,
}

/// term: "week" | "month" | "year"
#[tauri::command]
pub async fn fetch_circle(app: AppHandle, term: String) -> Result<SongChart, String> {
    let term = match term.as_str() {
        "month" | "year" => term,
        _ => "week".to_string(),
    };
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(20))
        .connect_timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    // 1) 기준값 읽기
    let page_url = format!("{BASE}/page_chart/onoff.circle?serviceGbn=ALL&termGbn={term}");
    let html = client
        .get(&page_url)
        .send()
        .await
        .map_err(|e| net_error(e))?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let var = |name: &str| -> Option<String> {
        let key = format!("var {name} = \"");
        let start = html.find(&key)? + key.len();
        let end = html[start..].find('"')? + start;
        Some(html[start..end].to_string())
    };
    let (Some(hit_year), Some(target_time)) = (var("hitYear"), var("targetTime")) else {
        return Err("써클차트 페이지에서 기준 날짜를 찾지 못했습니다. 사이트 구조가 바뀌었을 수 있습니다.".into());
    };
    let year_time = var("yearTime").unwrap_or_else(|| "3".into());

    // 2) 차트 데이터 요청
    let cur_url = format!("circlechart.kr/page_chart/onoff.circle?serviceGbn=ALL&termGbn={term}");
    let resp: Value = client
        .post(format!("{BASE}/data/api/chart/onoff"))
        .header("Referer", &page_url)
        .header("X-Requested-With", "XMLHttpRequest")
        .form(&[
            ("nationGbn", "T"),
            ("serviceGbn", "ALL"),
            ("termGbn", term.as_str()),
            ("hitYear", hit_year.as_str()),
            ("targetTime", target_time.as_str()),
            ("yearTime", year_time.as_str()),
            ("curUrl", cur_url.as_str()),
        ])
        .send()
        .await
        .map_err(|e| net_error(e))?
        .json()
        .await
        .map_err(|e| format!("써클차트 응답 해석 실패: {e}"))?;

    if resp["ResultStatus"].as_str() == Some("Error") {
        return Err(format!("써클차트 오류: {}", resp["ErrorMsg"].as_str().unwrap_or("알 수 없음")));
    }

    let items: Vec<&Value> = match &resp["List"] {
        Value::Object(m) => m.values().collect(),
        Value::Array(a) => a.iter().collect(),
        _ => vec![],
    };
    let s = |v: &Value, k: &str| v[k].as_str().map(str::trim).unwrap_or("").to_string();
    let mut entries: Vec<SongEntry> = items
        .into_iter()
        .filter_map(|v| {
            let rank: u32 = v["SERVICE_RANKING"].as_str().and_then(|r| r.parse().ok())
                .or_else(|| v["SERVICE_RANKING"].as_u64().map(|r| r as u32))?;
            let artist = s(v, "ARTIST_NAME");
            let info = lookup_artist(&artist);
            let img = s(v, "ALBUMIMG");
            Some(SongEntry {
                rank,
                song: s(v, "SONG_NAME"),
                album: s(v, "ALBUM_NAME"),
                image: (!img.is_empty()).then(|| if img.starts_with("http") { img } else { format!("{BASE}{img}") }),
                rank_status: s(v, "RankStatus"),
                rank_change: s(v, "RankChange").parse().unwrap_or(0),
                genre: info.as_ref().map(|i| i.genre).unwrap_or(artists::Genre::Other),
                search_artist: info.map(|i| i.search_name.to_string()).unwrap_or_else(|| clean_artist(&artist)),
                artist,
            })
        })
        .collect();
    entries.sort_by_key(|e| e.rank);

    if entries.is_empty() {
        return Err("써클차트에서 곡을 받지 못했습니다.".into());
    }

    let label = match term.as_str() {
        "month" => format!("{hit_year}년 {}월", target_time.trim_start_matches('0')),
        "year" => format!("20{target_time}년"),
        _ => format!("{hit_year}년 {target_time}주차"),
    };
    log(&app, format!("💿 써클차트 {label}: {}곡", entries.len()));

    Ok(SongChart {
        entries,
        label,
        fetched_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

fn net_error(e: reqwest::Error) -> String {
    if e.is_timeout() {
        "써클차트 응답이 너무 늦습니다. 잠시 뒤 새로고침하세요.".into()
    } else {
        format!("써클차트 접속 실패: {e}")
    }
}

/// "소연 (SOYEON)", "RESCENE (리센느)" 같은 이름을 사전에서 찾음
fn lookup_artist(raw: &str) -> Option<artists::Info> {
    artists::lookup(raw).or_else(|| {
        let (a, b) = raw.split_once(" (")?;
        artists::lookup(a).or_else(|| artists::lookup(b.trim_end_matches(')')))
    })
}

/// 사전에 없으면 괄호 안 영문/한글 중 앞부분만 검색에 사용
fn clean_artist(raw: &str) -> String {
    raw.split_once(" (").map(|(a, _)| a).unwrap_or(raw).trim().to_string()
}
