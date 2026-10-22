import { CheckCircle2, ChevronDown, Clapperboard, Download, Loader2, Search } from "lucide-react";
import Badge4K from "./Badge4K";
import Checkbox from "./Checkbox";
import { formatDate, formatDuration, formatSize, formatViews } from "../format";
import type { FoundMv } from "../types";

export type MvSort = "relevance" | "views" | "newest" | "oldest" | "likes" | "duration" | "size" | "title";

const SORTS: { v: MvSort; label: string }[] = [
  { v: "relevance", label: "검색순 (관련도)" },
  { v: "views", label: "조회수 높은순" },
  { v: "newest", label: "최신 등록순" },
  { v: "oldest", label: "오래된 등록순" },
  { v: "likes", label: "좋아요 많은순" },
  { v: "duration", label: "재생시간 긴순" },
  { v: "size", label: "파일 크기 큰순" },
  { v: "title", label: "제목순 (가나다)" },
];

export function sortResults(list: FoundMv[], sort: MvSort) {
  const n = (x: number | null) => x ?? -1;
  const arr = [...list];
  switch (sort) {
    case "views": return arr.sort((a, b) => n(b.viewCount) - n(a.viewCount));
    case "likes": return arr.sort((a, b) => n(b.likeCount) - n(a.likeCount));
    case "newest": return arr.sort((a, b) => (b.uploadDate ?? "").localeCompare(a.uploadDate ?? ""));
    case "oldest": return arr.sort((a, b) => (a.uploadDate ?? "99999999").localeCompare(b.uploadDate ?? "99999999"));
    case "duration": return arr.sort((a, b) => n(b.duration) - n(a.duration));
    case "size": return arr.sort((a, b) => n(b.estSize) - n(a.estSize));
    case "title": return arr.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    default: return arr;
  }
}

interface Props {
  results: FoundMv[];
  searching: string | null;
  selectedNames: string[];
  /** 고른 게 없을 때 보여 줄 안내 (탭마다 다름) */
  emptyHint: string;
  picked: Set<string>;
  queuedIds: Set<string>;
  downloadedIds: Set<string>;
  sort: MvSort;
  onSort: (v: MvSort) => void;
  onSearch: () => void;
  onPick: (id: string) => void;
  onDownload: (mv: FoundMv) => void;
  onBatch: () => void;
  onPickAll: (on: boolean) => void;
}

export default function ResultsPanel(p: Props) {
  const allPicked = p.results.length > 0 && p.results.every((r) => p.picked.has(r.id));
  const status = p.searching
    ? `'${p.searching}' 4K MV 검색 중…`
    : p.selectedNames.length
      ? `${p.selectedNames.length}개 선택: ${p.selectedNames.join(", ")}`
      : p.emptyHint;

  return (
    <section className="panel flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="space-y-4 px-5 pb-3 pt-5">
        <h2 className="text-[22px] font-bold tracking-tight">4K 뮤직비디오 검색 결과</h2>
        <div className="flex gap-2">
          <div className="field flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 text-[15px] text-muted">
            {p.searching ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
            ) : (
              <Search className="h-5 w-5 shrink-0" />
            )}
            <span className="truncate">{status}</span>
          </div>
          <button
            onClick={p.onSearch}
            disabled={!!p.searching || p.selectedNames.length === 0}
            className="btn-accent flex h-12 shrink-0 items-center gap-2 px-6 text-[15px] font-semibold"
          >
            <Search className="h-5 w-5" /> 4K 검색
          </button>
        </div>
        <div className="flex items-center gap-3 text-[15px] text-muted">
          <span>{p.results.length}개 영상</span>
          {p.results.length > 0 && (
            <button onClick={() => p.onPickAll(!allPicked)} className="text-sm font-semibold text-accent hover:underline">
              {allPicked ? "모두 해제" : "모두 선택"}
            </button>
          )}
          <div className="relative ml-auto">
            <select
              value={p.sort}
              onChange={(e) => p.onSort(e.target.value as MvSort)}
              className="btn-ghost appearance-none py-2 pl-3.5 pr-9 text-sm font-semibold text-fg outline-none"
            >
              {SORTS.map((x) => (
                <option key={x.v} value={x.v}>
                  {x.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg" />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-4">
        {p.results.length === 0 && !p.searching && (
          <div className="flex h-full flex-col items-center justify-center gap-4 pb-10 text-center text-muted">
            <Clapperboard className="h-14 w-14 opacity-50" strokeWidth={1.4} />
            <p className="text-[15px] leading-relaxed">
              아이돌을 선택하고 <b className="text-fg">4K 검색</b>을 누르면
              <br />
              실제 2160p 화질이 있는 MV만 표시됩니다.
            </p>
          </div>
        )}
        {p.results.map((mv, i) => {
          const picked = p.picked.has(mv.id);
          const queued = p.queuedIds.has(mv.id);
          const done = p.downloadedIds.has(mv.id);
          return (
            <div
              key={mv.id}
              onClick={() => p.onPick(mv.id)}
              className={`card relative flex cursor-pointer gap-4 p-3 transition ${
                picked ? "!border-accent bg-accent-soft" : "hover:brightness-[1.03]"
              }`}
            >
              <span className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-1.5 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="relative h-[90px] w-40 shrink-0 overflow-hidden rounded-xl bg-inset max-[600px]:h-[68px] max-[600px]:w-[120px]">
                {mv.thumbnail && <img src={mv.thumbnail} className="h-full w-full object-cover" />}
                {done && (
                  <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    <CheckCircle2 className="h-3 w-3" /> 다운로드됨
                  </span>
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[11px] tabular-nums text-white">
                  {formatDuration(mv.duration)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2">
                  <p className="line-clamp-2 flex-1 font-bold leading-snug" title={mv.title}>
                    {mv.title}
                  </p>
                  <Badge4K height={mv.maxHeight} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {mv.channel} · {mv.artist}
                </p>
                <p className="truncate text-xs text-muted">
                  {[formatViews(mv.viewCount) && `조회수 ${formatViews(mv.viewCount)}`, formatDate(mv.uploadDate)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-auto flex items-center gap-2">
                  <span className="truncate whitespace-nowrap text-sm max-[600px]:text-xs">
                    {mv.maxHeight}p{mv.fps ? `, ${Math.round(mv.fps)}fps` : ""}, {formatSize(mv.estSize)}
                  </span>
                  <span className="ml-auto">
                    <Checkbox on={picked} />
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onDownload(mv);
                    }}
                    disabled={queued}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold ${
                      done ? "btn-ghost !rounded-full" : "btn-accent"
                    } disabled:opacity-50`}
                  >
                    {queued ? "대기열에 있음" : done ? "다시 받기" : "Download"} <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {p.results.length > 0 && (
        <div className="border-t border-line p-3">
          <button
            onClick={p.onBatch}
            disabled={p.picked.size === 0}
            className="btn-accent w-full py-3 text-[15px] font-semibold"
          >
            선택 항목 일괄 다운로드 {p.picked.size > 0 && `(${p.picked.size}개)`}
          </button>
        </div>
      )}
    </section>
  );
}
