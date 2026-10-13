// 맥(데스크톱)과 안드로이드의 다운로드 엔진 차이를 한곳에서 처리
//
//   맥:      Rust가 번들한 yt-dlp 실행 → 앱 이벤트(search://result, download://progress …)로 결과 전달
//   안드로이드: Kotlin 플러그인(youtubedl-android) 호출 → Channel로 결과 전달
//
// 화면 코드는 이 파일의 함수만 부르고, 결과는 넘겨준 콜백으로 받음

import { Channel, invoke } from "@tauri-apps/api/core";
import type { MvResult } from "./types";

export const isAndroid = /Android/i.test(navigator.userAgent);
export const isWindows = /Windows/i.test(navigator.userAgent);
export const isMac = !isAndroid && /Mac/i.test(navigator.userAgent);

/** 받은 파일 보기 버튼 문구 */
export const revealLabel = isAndroid ? "열기" : isWindows ? "탐색기에서 보기" : "Finder에서 보기";

interface DownloadHandlers {
  onProgress: (p: { percent: number; speed: string; eta: string; stage: string }) => void;
  onDone: (path: string) => void;
  onError: (message: string) => void;
}

/** 안드로이드: 엔진 준비 (최초 압축 해제 + yt-dlp 최신 버전 업데이트) */
export async function initEngine(): Promise<string | null> {
  if (!isAndroid) return null;
  const r = await invoke<{ version?: string; update?: string; updateError?: string }>("plugin:ytdl|init");
  return `yt-dlp ${r.version ?? "?"} (업데이트: ${r.update ?? r.updateError ?? "-"})`;
}

/** yt-dlp -j 결과 한 줄 → 4K 포맷이 있으면 MvResult (Rust search.rs와 같은 기준) */
function to4k(v: any): MvResult | null {
  const formats: any[] = v.formats ?? [];
  const size = (f: any) => f.filesize ?? f.filesize_approx ?? null;
  const video = formats
    .filter((f) => f.vcodec && f.vcodec !== "none" && (f.height ?? 0) >= 2160)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (size(b) ?? 0) - (size(a) ?? 0))[0];
  if (!video || !v.id || !v.webpage_url) return null;
  const audio = formats
    .filter((f) => f.vcodec === "none" && f.acodec && f.acodec !== "none")
    .sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0];
  const vs = size(video);
  return {
    id: v.id,
    url: v.webpage_url,
    title: v.title ?? "제목 없음",
    channel: v.channel ?? v.uploader ?? "",
    thumbnail: v.thumbnail ?? null,
    duration: v.duration ?? null,
    maxHeight: video.height ?? 2160,
    fps: video.fps ?? null,
    estSize: vs != null ? vs + (audio ? size(audio) ?? 0 : 0) : null,
    viewCount: v.view_count ?? null,
    likeCount: v.like_count ?? null,
    uploadDate: v.upload_date ?? null,
  };
}

/**
 * 유튜브 검색 (4K만). 맥에서는 결과가 search://result 이벤트로 오고,
 * 안드로이드에서는 onResult 콜백으로 옴. 반환값 = 4K 영상 수
 */
export async function search4k(
  label: string,
  query: string,
  count: number,
  onResult: (artist: string, video: MvResult) => void,
): Promise<number> {
  if (!isAndroid) return invoke<number>("search_4k", { artist: label, query, count });

  let found = 0;
  const ch = new Channel<{ type: string; line?: string }>();
  ch.onmessage = (m) => {
    if (m.type !== "json" || !m.line) return;
    try {
      const mv = to4k(JSON.parse(m.line));
      if (mv) {
        found++;
        onResult(label, mv);
      }
    } catch {
      /* JSON이 아닌 줄은 무시 */
    }
  };
  await invoke("plugin:ytdl|search", { query: `${query}`, count, onEvent: ch });
  return found;
}

/** 다운로드 시작. 맥은 즉시 반환(이벤트로 진행), 안드로이드는 끝날 때까지 기다리며 콜백 호출 */
export async function startDownload(
  req: { id: string; url: string; title: string; folder: string; container: string },
  h: DownloadHandlers,
) {
  if (!isAndroid) {
    await invoke("start_download", { req });
    return;
  }
  const ch = new Channel<{ type: string; percent: number; speed: string; eta: string; stage: string }>();
  ch.onmessage = (m) => m.type === "progress" && h.onProgress(m);
  invoke<{ path: string }>("plugin:ytdl|download", { req, onEvent: ch })
    .then((r) => h.onDone(r.path))
    .catch((e) => {
      if (String(e) !== "취소됨") h.onError(String(e));
    });
}

export function cancelDownload(id: string) {
  return isAndroid ? invoke("plugin:ytdl|cancel", { id }) : invoke("cancel_download", { id });
}

/** 맥: Finder에서 보기 / 안드로이드: 동영상 플레이어로 열기 */
export function revealFile(path: string) {
  return isAndroid ? invoke("plugin:ytdl|open_file", { path }) : invoke("reveal_in_finder", { path });
}
