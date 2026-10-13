import { Loader2, RefreshCw, Search } from "lucide-react";
import Checkbox from "./Checkbox";
import GenreSelect from "./GenreSelect";
import type { Chart, ChartEntry, Genre } from "../types";

export type ArtistSort = "rank" | "name";

interface Props {
  chart: Chart | null;
  loading: boolean;
  error: string;
  period: string;
  genres: Set<Genre>;
  sort: ArtistSort;
  rankedOnly: boolean;
  query: string;
  selected: Set<string>;
  onRefresh: () => void;
  onPeriod: (v: string) => void;
  onGenres: (v: Set<Genre>) => void;
  onSort: (v: ArtistSort) => void;
  onRankedOnly: (v: boolean) => void;
  onQuery: (v: string) => void;
  onToggle: (name: string) => void;
  onSetMany: (names: string[], on: boolean) => void;
}

const PERIODS = [
  { v: "", label: "실시간" },
  { v: "W", label: "주간" },
  { v: "M", label: "월간" },
  { v: "Y", label: "연간" },
];

/** 장르·검색어·순위 필터 + 정렬 */
export function visibleArtists(
  entries: ChartEntry[],
  genres: Set<Genre>,
  rankedOnly: boolean,
  query: string,
  sort: ArtistSort,
) {
  const q = query.trim().toLowerCase();
  const list = entries
    .filter((e) => genres.size === 0 || genres.has(e.genre))
    .filter((e) => !rankedOnly || e.rank != null)
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.searchName.toLowerCase().includes(q));
  return [...list].sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name, "ko")
      : (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.name.localeCompare(b.name, "ko"),
  );
}

export default function ChartPanel(p: Props) {
  const entries = p.chart?.entries ?? [];
  const list = visibleArtists(entries, p.genres, p.rankedOnly, p.query, p.sort);
  const allOn = list.length > 0 && list.every((e) => p.selected.has(e.name));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[17px] font-bold">아이돌차트 랭킹</p>
            <p className="text-[13px] text-muted">
              {p.chart ? `${p.chart.rankedCount}위까지 · 전체 ${entries.length}명` : "불러오는 중"}
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

        <div className="field grid grid-cols-4 gap-1 rounded-full p-1">
          {PERIODS.map((x) => (
            <button
              key={x.v}
              onClick={() => p.onPeriod(x.v)}
              disabled={p.loading}
              className={`rounded-full py-1.5 text-sm font-semibold transition ${
                p.period === x.v ? "btn-accent" : "text-muted hover:text-fg"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <GenreSelect
            value={p.genres}
            onChange={p.onGenres}
            counts={(g) => entries.filter((e) => e.genre === g && (!p.rankedOnly || e.rank != null)).length}
          />
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={p.query}
              onChange={(e) => p.onQuery(e.target.value)}
              placeholder="아티스트 검색..."
              className="field h-10 w-full pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <select
            value={p.sort}
            onChange={(e) => p.onSort(e.target.value as ArtistSort)}
            className="field rounded-lg px-2 py-1 text-fg outline-none"
          >
            <option value="rank">순위순</option>
            <option value="name">이름순</option>
          </select>
          <label className="flex cursor-pointer items-center gap-1">
            <input type="checkbox" checked={p.rankedOnly} onChange={(e) => p.onRankedOnly(e.target.checked)} />
            차트만
          </label>
          <span className="ml-auto">
            {list.filter((e) => p.selected.has(e.name)).length}/{list.length}명
          </span>
          <button
            onClick={() => p.onSetMany(list.map((e) => e.name), !allOn)}
            disabled={list.length === 0}
            className="font-semibold text-accent hover:underline disabled:opacity-40"
          >
            {allOn ? "모두 해제" : "모두 선택"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {p.error && <p className="m-2 rounded-xl bg-red-950/50 p-3 text-xs text-red-300">{p.error}</p>}
        {p.loading && !p.chart && <p className="p-6 text-center text-sm text-muted">차트 전체 페이지 불러오는 중…</p>}
        {list.map((e) => {
          const on = p.selected.has(e.name);
          return (
            <button
              key={e.name}
              onClick={() => p.onToggle(e.name)}
              className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition ${
                on ? "bg-accent-soft" : "hover:bg-surface"
              }`}
            >
              <span className="w-7 shrink-0 text-center text-[15px] font-medium tabular-nums">{e.rank ?? "–"}</span>
              {e.image ? (
                <img src={e.image} loading="lazy" className="h-12 w-12 shrink-0 rounded-full bg-surface object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-sm text-muted">
                  {e.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{e.name}</p>
                <p className="truncate text-[13px] text-muted">
                  {e.genre}
                  {e.searchName !== e.name && ` · ${e.searchName}`}
                </p>
              </div>
              <Checkbox on={on} />
            </button>
          );
        })}
        {p.chart && list.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">조건에 맞는 아티스트가 없습니다</p>
        )}
      </div>
    </div>
  );
}
