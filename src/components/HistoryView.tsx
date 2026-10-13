import { revealLabel } from "../backend";
import { FolderSearch, History, Trash2, X } from "lucide-react";

export interface HistoryItem {
  jobId: string;
  title: string;
  artist: string;
  thumbnail: string | null;
  path: string;
  height: number;
  /** ISO 날짜 */
  at: string;
}

interface Props {
  items: HistoryItem[];
  onReveal: (path: string) => void;
  onRemove: (jobId: string) => void;
  onClear: () => void;
}

function formatAt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 지금까지 받은 영상 기록 (앱을 꺼도 유지) */
export default function HistoryView({ items, onReveal, onRemove, onClear }: Props) {
  return (
    <section className="panel flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-6 pb-4 pt-5">
        <h2 className="text-[22px] font-bold tracking-tight">다운로드 히스토리</h2>
        <span className="text-[15px] text-muted">{items.length}개</span>
        {items.length > 0 && (
          <button onClick={onClear} className="btn-ghost ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Trash2 className="h-4 w-4" /> 기록 모두 지우기
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted">
            <History className="h-14 w-14 opacity-50" strokeWidth={1.4} />
            <p className="text-[15px]">아직 받은 영상이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {items.map((h) => (
              <div key={h.jobId} className="card group overflow-hidden">
                <div className="relative aspect-video bg-inset">
                  {h.thumbnail && <img src={h.thumbnail} loading="lazy" className="h-full w-full object-cover" />}
                  <button
                    onClick={() => onRemove(h.jobId)}
                    title="기록에서 지우기 (파일은 그대로)"
                    className="absolute right-2 top-2 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 text-[11px] font-bold text-white">
                    {h.height >= 2160 ? "4K" : `${h.height}p`}
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-bold leading-snug" title={h.title}>
                    {h.title}
                  </p>
                  <p className="truncate text-xs text-muted">{h.artist}</p>
                  <div className="flex items-center pt-1 text-xs text-muted">
                    <span className="tabular-nums">{formatAt(h.at)}</span>
                    <button
                      onClick={() => onReveal(h.path)}
                      className="ml-auto flex items-center gap-1 font-semibold text-accent hover:underline"
                    >
                      <FolderSearch className="h-3.5 w-3.5" /> {revealLabel}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
