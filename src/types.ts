export const GENRES = [
  "걸그룹",
  "보이그룹",
  "여자 솔로",
  "남자 솔로",
  "혼성",
  "힙합",
  "트로트",
  "밴드",
  "발라드·R&B",
  "기타",
] as const;
export type Genre = (typeof GENRES)[number];

export interface ChartEntry {
  /** 차트 순위 (내장 사전에서만 온 아티스트는 null) */
  rank: number | null;
  name: string;
  image: string | null;
  point: number | null;
  genre: Genre;
  searchName: string;
}

export interface Chart {
  entries: ChartEntry[];
  rankedCount: number;
  fetchedAt: string;
}

export interface SongEntry {
  rank: number;
  song: string;
  artist: string;
  album: string;
  image: string | null;
  /** "up" | "down" | "same" | "new" */
  rankStatus: string;
  rankChange: number;
  genre: Genre;
  searchArtist: string;
}

export interface SongChart {
  entries: SongEntry[];
  label: string;
  fetchedAt: string;
}

/** 플레이리스트 안의 영상 하나 (목록만 — 4K인지는 고른 뒤 확인한다) */
export interface PlaylistItem {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: number | null;
  thumbnail: string | null;
}

export interface PlaylistInfo {
  title: string;
  items: PlaylistItem[];
  /** 너무 길어서 앞에서 끊었는지 */
  truncated: boolean;
}

export interface MvResult {
  id: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  duration: number | null;
  maxHeight: number;
  fps: number | null;
  estSize: number | null;
  viewCount: number | null;
  likeCount: number | null;
  /** "YYYYMMDD" */
  uploadDate: string | null;
}

/** 검색 결과 + 어느 아이돌 검색에서 나왔는지 */
export interface FoundMv extends MvResult {
  artist: string;
}

export type JobState = "queued" | "running" | "done" | "error" | "cancelled";

export interface Job {
  id: string;
  mv: FoundMv;
  state: JobState;
  percent: number;
  speed: string;
  eta: string;
  stage: string;
  path?: string;
  error?: string;
  /** 403 등으로 자동 재시도한 횟수 */
  retries?: number;
}

// 백엔드 이벤트 페이로드
export interface ProgressEvent {
  id: string;
  percent: number;
  speed: string;
  eta: string;
  stage: string;
}
export interface DoneEvent {
  id: string;
  path: string;
}
export interface ErrorEvent {
  id: string;
  message: string;
}
export interface SearchResultEvent {
  artist: string;
  video: MvResult;
}
