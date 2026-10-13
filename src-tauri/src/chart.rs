//! 아이돌차트 랭킹 스크래핑 (모든 페이지)
//!
//! 페이지 구조 (2026-10 기준):
//!   /ranking/?d_type=W|M|Y&page=N   (d_type 없으면 기본 차트, 페이지당 20명)
//!   div.idol_item
//!     div.no            → 순위
//!     div.photo img     → 프로필 사진
//!     span.txt01        → 아티스트 이름
//!     div.point         → 점수
//!
//! 차트에 없는 사전 아티스트(트로트·힙합 등)도 순위 없이 뒤에 붙여 돌려줌

use crate::{artists, log};
use scraper::{Html, Selector};
use serde::Serialize;
use std::time::Duration;
use tauri::AppHandle;

const CHART_URL: &str = "https://www.idol-chart.com/ranking/";
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
    (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAX_PAGES: u32 = 50; // 무한 반복 방지

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartEntry {
    /// 차트 순위 (사전에서만 온 아티스트는 None)
    rank: Option<u32>,
    name: String,
    image: Option<String>,
    point: Option<u32>,
    genre: artists::Genre,
    /// 유튜브 검색용 이름
    search_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Chart {
    entries: Vec<ChartEntry>,
    ranked_count: usize,
    fetched_at: String,
}

/// period: "" (기본) | "W" (주간) | "M" (월간) | "Y" (연간)
#[tauri::command]
pub async fn fetch_chart(app: AppHandle, period: String) -> Result<Chart, String> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let mut entries: Vec<ChartEntry> = Vec::new();
    for page in 1..=MAX_PAGES {
        let mut url = format!("{CHART_URL}?page={page}");
        if matches!(period.as_str(), "W" | "M" | "Y") {
            url.push_str(&format!("&d_type={period}"));
        }
        let html = fetch_page(&client, &url).await?;
        let found = parse(&html);
        if found.is_empty() {
            break; // 마지막 페이지 지남
        }
        // 같은 페이지가 반복되면(사이트가 마지막 페이지를 계속 돌려줄 때) 중단
        if found.iter().all(|f| entries.iter().any(|e| e.name == f.name)) {
            break;
        }
        log(&app, format!("📄 차트 {page}페이지: {}명", found.len()));
        entries.extend(found);
        // 서버 부담을 줄이려고 페이지 사이에 잠깐 쉼
        tokio_sleep(Duration::from_millis(300)).await;
    }

    if entries.is_empty() {
        return Err("랭킹을 찾지 못했습니다. 아이돌차트 페이지 구조가 바뀌었을 수 있습니다.".into());
    }
    let ranked_count = entries.len();

    // 차트에 없는 사전 아티스트 추가 (순위 없음)
    for (ko, en, genre) in artists::all() {
        if !entries.iter().any(|e| artists::same(&e.name, ko)) {
            entries.push(ChartEntry {
                rank: None,
                name: ko.to_string(),
                image: None,
                point: None,
                genre,
                search_name: en.to_string(),
            });
        }
    }

    Ok(Chart {
        entries,
        ranked_count,
        fetched_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

async fn tokio_sleep(d: Duration) {
    tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await.ok();
}

async fn fetch_page(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let resp = client
        .get(url)
        .header("Accept-Language", "ko-KR,ko;q=0.9")
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "아이돌차트 응답이 너무 늦습니다 (15초 초과). 잠시 뒤 새로고침하세요.".to_string()
            } else {
                format!("아이돌차트 접속 실패: {e}")
            }
        })?;
    if !resp.status().is_success() {
        return Err(format!("아이돌차트가 오류를 돌려줬습니다 (HTTP {})", resp.status().as_u16()));
    }
    resp.text().await.map_err(|e| format!("페이지 읽기 실패: {e}"))
}

fn parse(html: &str) -> Vec<ChartEntry> {
    let doc = Html::parse_document(html);
    let item = Selector::parse("div.idol_item").unwrap();
    let no = Selector::parse("div.no").unwrap();
    let name = Selector::parse("span.txt01").unwrap();
    let img = Selector::parse("div.photo img").unwrap();
    let point = Selector::parse("div.point").unwrap();

    let text = |el: scraper::ElementRef| el.text().collect::<String>().trim().to_string();

    doc.select(&item)
        .filter_map(|el| {
            let name = el.select(&name).next().map(text)?;
            if name.is_empty() {
                return None;
            }
            let rank = el.select(&no).next().and_then(|n| text(n).parse().ok());
            let image = el.select(&img).next().and_then(|i| i.value().attr("src")).map(|src| {
                if src.starts_with("http") { src.to_string() } else { format!("https://www.idol-chart.com{src}") }
            });
            let point = el
                .select(&point)
                .next()
                .and_then(|p| text(p).replace(',', "").parse().ok());
            let info = artists::lookup(&name);
            Some(ChartEntry {
                rank,
                genre: info.as_ref().map(|i| i.genre).unwrap_or(artists::Genre::Other),
                search_name: info.map(|i| i.search_name.to_string()).unwrap_or_else(|| name.clone()),
                name,
                image,
                point,
            })
        })
        .collect()
}
