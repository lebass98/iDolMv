import { Loader2, RefreshCw, Search } from "lucide-react";
import Checkbox from "./Checkbox";
import GenreSelect from "./GenreSelect";
import type { Genre, SongChart, SongEntry } from "../types";

export type SongSort = "rank" | "song" | "artist";

interface Props {
  chart: SongChart | null;
  loading: boolean;
  error: string;
  term: string;
  genres: Set<Genre>;
  sort: SongSort;
  query: string;
  selected: Set<string>;
  onRefresh: () => void;
  onTerm: (v: string) => void;
  onGenres: (v: Set<Genre>) => void;
  onSort: (v: SongSort) => void;
  onQuery: (v: string) => void;
  onToggle: (key: string) => void;
  onSetMany: (keys: string[], on: boolean) => void;
}

const TERMS = [
  { v: "week", label: "주간" },
  { v: "month", label: "월간" },
  { v: "year", label: "연간" },
];

/** 곡을 구분하는 키 (순위가 바뀌어도 같은 곡이면 같은 키) */
export const songKey = (e: SongEntry) => `${e.artist}|${e.song}`;

export function visibleSongs(entries: SongEntry[], genres: Set<Genre>, query: string, sort: SongSort) {
  const q = query.trim().toLowerCase();
  const list = entries
    .filter((e) => genres.size === 0 || genres.has(e.genre))
    .filter(
      (e) =>
        !q ||
        e.song.toLowerCase().includes(q) ||
        e.artist.toLowerCase().includes(q) ||
        e.album.toLowerCase().includes(q),
    );
  return [...list].sort((a, b) =>
    sort === "song"
      ? a.song.localeCompare(b.song, "ko")
      : sort === "artist"
        ? a.artist.localeCompare(b.artist, "ko") || a.rank - b.rank
        : a.rank - b.rank,
  );
}

function RankMove({ e }: { e: SongEntry }) {
  if (e.rankStatus === "new") return <span className="text-[10px] font-bold text-amber-400">NEW</span>;
  if (e.rankStatus === "up") return <span className="text-[10px] text-rose-400">▲{e.rankChange}</span>;
  if (e.rankStatus === "down") return <span className="text-[10px] text-sky-400">▼{e.rankChange}</span>;
  return <span className="text-[10px] text-muted">–</span>;
}

export default function SongPanel(p: Props) {
  const entries = p.chart?.entries ?? [];
  const list = visibleSongs(entries, p.genres, p.query, p.sort);
  const allOn = list.length > 0 && list.every((e) => p.selected.has(songKey(e)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[17px] font-bold">써클차트 디지털 차트</p>
            <p className="text-[13px] text-muted">
              {p.chart ? `${p.chart.label} · ${entries.length}곡` : "불러오는 중"}
            </p>
            <p className="text-[13px] tabular-nums text-muted">{p.chart?.fetchedAt ?? "—"}</p>
          </div>
          <button
            onClick={p.onRefresh}
            disabled={p.loading}
            className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold disabled:opacity-50"
          >
            {p.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            새로고침
          </button>
        </div>

        {/* 주간 / 월간 / 연간 */}
        <div className="field grid grid-cols-3 gap-1 rounded-full p-1">
          {TERMS.map((x) => (
            <button
              key={x.v}
              onClick={() => p.onTerm(x.v)}
              disabled={p.loading}
              className={`rounded-full py-1.5 text-sm font-semibold transition ${
                p.term === x.v ? "btn-accent" : "text-muted hover:text-fg"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <GenreSelect value={p.genres} onChange={p.onGenres} counts={(g) => entries.filter((e) => e.genre === g).length} />
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={p.query}
              onChange={(e) => p.onQuery(e.target.value)}
              placeholder="곡명·가수·앨범 검색..."
              className="field h-10 w-full pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <select
            value={p.sort}
            onChange={(e) => p.onSort(e.target.value as SongSort)}
            className="field rounded-lg px-2 py-1 text-fg outline-none"
          >
            <option value="rank">순위순</option>
            <option value="song">곡명순</option>
            <option value="artist">가수명순</option>
          </select>
          <span className="ml-auto">
            {list.filter((e) => p.selected.has(songKey(e))).length}/{list.length}곡
          </span>
          <button
            onClick={() => p.onSetMany(list.map(songKey), !allOn)}
            disabled={list.length === 0}
            className="font-semibold text-accent hover:underline disabled:opacity-40"
          >
            {allOn ? "모두 해제" : "모두 선택"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {p.error && <p className="m-2 rounded-xl bg-red-950/50 p-3 text-xs text-red-300">{p.error}</p>}
        {p.loading && !p.chart && <p className="p-6 text-center text-sm text-muted">써클차트 불러오는 중…</p>}
        {list.map((e) => {
          const key = songKey(e);
          const on = p.selected.has(key);
          return (
            <button
              key={key}
              onClick={() => p.onToggle(key)}
              className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition ${
                on ? "bg-accent-soft" : "hover:bg-surface"
              }`}
            >
              <div className="flex w-7 shrink-0 flex-col items-center leading-tight">
                <span className="text-[15px] font-medium tabular-nums">{e.rank}</span>
                <RankMove e={e} />
              </div>
              {e.image ? (
                <img src={e.image} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-surface object-cover" />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-xl bg-surface" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold" title={e.song}>
                  {e.song}
                </p>
                <p className="truncate text-[13px] text-muted" title={`${e.artist} · ${e.album}`}>
                  {e.artist}
                </p>
              </div>
              <Checkbox on={on} />
            </button>
          );
        })}
        {p.chart && list.length === 0 && <p className="p-6 text-center text-sm text-muted">조건에 맞는 곡이 없습니다</p>}
      </div>
    </div>
  );
}
