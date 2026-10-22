import { ListPlus, Loader2, Search } from "lucide-react";
import Checkbox from "./Checkbox";
import { formatDuration } from "../format";
import type { PlaylistInfo, PlaylistItem } from "../types";

interface Props {
  url: string;
  info: PlaylistInfo | null;
  loading: boolean;
  error: string;
  query: string;
  selected: Set<string>;
  onUrl: (v: string) => void;
  onLoad: () => void;
  onQuery: (v: string) => void;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
}

/** 제목·채널로 걸러낸 목록 (순서는 플레이리스트 그대로 둔다) */
export function visibleItems(items: PlaylistItem[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((e) => e.title.toLowerCase().includes(q) || e.channel.toLowerCase().includes(q));
}

export default function PlaylistPanel(p: Props) {
  const items = p.info?.items ?? [];
  const list = visibleItems(items, p.query);
  const allOn = list.length > 0 && list.every((e) => p.selected.has(e.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-4 pb-3 pt-4">
        <div>
          <p className="text-[17px] font-bold">유튜브 플레이리스트</p>
          <p className="text-[13px] text-muted">
            {p.info ? `${p.info.title} · ${items.length}개` : "주소를 넣고 불러오기를 누르세요"}
          </p>
        </div>

        {/* 주소 입력 → 불러오기 */}
        <div className="flex gap-2">
          <input
            value={p.url}
            onChange={(e) => p.onUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !p.loading && p.onLoad()}
            placeholder="https://www.youtube.com/playlist?list=..."
            spellCheck={false}
            className="field h-10 min-w-0 flex-1 px-3 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            onClick={p.onLoad}
            disabled={p.loading || !p.url.trim()}
            className="btn-accent flex shrink-0 items-center gap-1.5 px-4 text-sm font-semibold disabled:opacity-50"
          >
            {p.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
            불러오기
          </button>
        </div>

        {/* 목록이 있을 때만 검색·모두 선택 */}
        {items.length > 0 && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={p.query}
                onChange={(e) => p.onQuery(e.target.value)}
                placeholder="제목·채널 검색..."
                className="field h-10 w-full pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>
                {list.filter((e) => p.selected.has(e.id)).length}/{list.length}개 선택
              </span>
              <button
                onClick={() => p.onSetMany(list.map((e) => e.id), !allOn)}
                disabled={list.length === 0}
                className="ml-auto font-semibold text-accent hover:underline disabled:opacity-40"
              >
                {allOn ? "모두 해제" : "모두 선택"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {p.error && <p className="m-2 rounded-xl bg-red-950/50 p-3 text-xs text-red-300">{p.error}</p>}
        {p.loading && <p className="p-6 text-center text-sm text-muted">목록 불러오는 중…</p>}
        {!p.loading && !p.info && !p.error && (
          <div className="px-5 py-8 text-center text-[13px] leading-6 text-muted">
            <p>유튜브 플레이리스트 주소를 넣으면 안에 든 영상을 목록으로 보여 줍니다.</p>
            <p className="mt-2">받을 곡을 고른 뒤 4K 검색을 누르면, 고른 영상 중 실제 4K가 있는 것만 결과에 나옵니다.</p>
          </div>
        )}
        {p.info?.truncated && (
          <p className="mx-2 mb-2 rounded-xl bg-amber-950/40 p-2.5 text-[11px] leading-4 text-amber-300">
            목록이 길어서 앞 {items.length}개만 가져왔습니다.
          </p>
        )}
        {list.map((e, i) => {
          const on = p.selected.has(e.id);
          return (
            <button
              key={e.id}
              onClick={() => p.onToggle(e.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition ${
                on ? "bg-accent-soft" : "hover:bg-surface"
              }`}
            >
              <span className="w-7 shrink-0 text-center text-[15px] font-medium tabular-nums text-muted">{i + 1}</span>
              {e.thumbnail ? (
                <img src={e.thumbnail} loading="lazy" className="h-12 w-[68px] shrink-0 rounded-xl bg-surface object-cover" />
              ) : (
                <div className="h-12 w-[68px] shrink-0 rounded-xl bg-surface" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold" title={e.title}>
                  {e.title}
                </p>
                <p className="truncate text-[13px] text-muted" title={e.channel}>
                  {e.channel}
                  {e.duration ? ` · ${formatDuration(e.duration)}` : ""}
                </p>
              </div>
              <Checkbox on={on} />
            </button>
          );
        })}
        {p.info && list.length === 0 && <p className="p-6 text-center text-sm text-muted">조건에 맞는 영상이 없습니다</p>}
      </div>
    </div>
  );
}
