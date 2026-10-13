import { revealLabel } from "../backend";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CloudDownload,
  Download,
  FolderOpen,
  FolderSearch,
  ListVideo,
  RotateCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { Job } from "../types";

interface Props {
  folder: string;
  container: string;
  jobs: Job[];
  logs: string[];
  canChangeFolder: boolean;
  onChangeFolder: () => void;
  onContainer: (v: string) => void;
  onCancel: (id: string) => void;
  onCancelAll: () => void;
  onRetry: (id: string) => void;
  onReveal: (path: string) => void;
  onClearFinished: () => void;
  onClearLogs: () => void;
}

export default function QueuePanel(p: Props) {
  const active = p.jobs.find((j) => j.state === "running");
  const queued = p.jobs.filter((j) => j.state === "queued");
  const finished = p.jobs.filter((j) => ["done", "error", "cancelled"].includes(j.state));
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [p.logs, showLog]);

  return (
    <section className="panel flex w-[370px] shrink-0 flex-col overflow-hidden">
      <div className="space-y-3 px-5 pb-4 pt-5">
        <h2 className="text-[22px] font-bold tracking-tight">다운로드 진행 현황</h2>
        <p className="text-[15px] text-muted">저장 위치</p>
        <div className="flex gap-2">
          <div className="field flex h-10 min-w-0 flex-1 items-center rounded-full px-4 text-sm" title={p.folder}>
            <span className="truncate">{p.folder}</span>
          </div>
          {p.canChangeFolder && (
            <button onClick={p.onChangeFolder} className="btn-ghost flex items-center gap-1.5 px-3 text-sm font-semibold">
              <FolderOpen className="h-4 w-4" /> 변경
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[15px] text-muted">
          병합 형식
          {["mp4", "mkv"].map((c) => (
            <button
              key={c}
              onClick={() => p.onContainer(c)}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold uppercase ${
                p.container === c ? "btn-accent" : "field !rounded-full text-muted hover:text-fg"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 현재 다운로드 */}
        {active ? (
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Download className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold">{active.mv.title}</p>
                <p className="mt-0.5 text-xs text-muted">{active.stage}</p>
              </div>
              <button onClick={() => p.onCancel(active.id)} title="취소" className="text-muted hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-inset">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${active.percent}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted">
              <span className="font-semibold text-fg">{active.percent.toFixed(1)}%</span>
              <span>
                {active.speed}
                {active.eta && ` · 남은 시간 ${active.eta}`}
              </span>
            </div>
          </div>
        ) : (
          <div className="card flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <CloudDownload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[15px] font-bold">진행 중인 다운로드 없음</p>
              <p className="text-[13px] text-muted">검색 후 다운로드를 시작해보세요.</p>
            </div>
          </div>
        )}
      </div>

      {/* 대기열 */}
      <div className="flex items-center border-t border-line px-5 py-3">
        <span className="text-[17px] font-bold">Queue ({queued.length})</span>
        <button
          onClick={p.onCancelAll}
          disabled={queued.length === 0 && !active}
          className="btn-ghost ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" /> 전체 취소
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-3">
        {queued.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 px-4 py-6 text-center text-muted">
            <ListVideo className="h-8 w-8 opacity-60" strokeWidth={1.5} />
            <p className="text-sm text-fg">대기 중인 항목이 없습니다.</p>
            <p className="text-[13px]">차트에서 곡을 선택하고 다운로드를 시작하세요.</p>
          </div>
        ) : (
          queued.map((j) => (
            <div key={j.id} className="card flex items-center gap-2.5 px-3 py-2.5 text-sm">
              <Download className="h-4 w-4 shrink-0 text-muted" />
              <span className="flex-1 truncate">{j.mv.title}</span>
              <span className="shrink-0 text-xs text-muted">{j.stage}</span>
              <button onClick={() => p.onCancel(j.id)} className="text-muted hover:text-fg">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}

        {finished.length > 0 && (
          <>
            <div className="flex items-center pt-2 text-sm font-bold">
              완료 ({finished.length})
              <button onClick={p.onClearFinished} className="ml-auto text-muted hover:text-fg" title="목록 지우기">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {finished.map((j) => (
              <div key={j.id} className="flex items-start gap-2 px-1 py-1 text-sm">
                {j.state === "done" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className={`mt-0.5 h-4 w-4 shrink-0 ${j.state === "error" ? "text-red-400" : "text-muted"}`} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{j.mv.title}</p>
                  {j.state === "error" && <p className="text-xs text-red-400">{j.error}</p>}
                  {j.state === "cancelled" && <p className="text-xs text-muted">취소됨</p>}
                </div>
                {(j.state === "error" || j.state === "cancelled") && (
                  <button onClick={() => p.onRetry(j.id)} title="다시 시도" className="text-muted hover:text-fg">
                    <RotateCw className="h-4 w-4" />
                  </button>
                )}
                {j.path && (
                  <button onClick={() => p.onReveal(j.path!)} title={revealLabel} className="text-muted hover:text-fg">
                    <FolderSearch className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* 로그 (접기/펼치기) */}
      <div className="border-t border-line px-5 py-2.5">
        <button onClick={() => setShowLog(!showLog)} className="flex w-full items-center gap-2 text-sm text-muted">
          <span className={`h-2 w-2 rounded-full ${active ? "animate-pulse bg-accent" : "bg-emerald-400"}`} />
          Status 로그
          <ChevronDown className={`ml-auto h-4 w-4 transition ${showLog ? "rotate-180" : ""}`} />
        </button>
        {showLog && (
          <div className="mt-2">
            <div
              ref={logRef}
              className="field h-36 select-text overflow-y-auto p-2 font-mono text-[11px] leading-relaxed text-muted"
            >
              {p.logs.length === 0 ? "로그 없음" : p.logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            <button onClick={p.onClearLogs} className="mt-1 text-xs text-muted hover:text-fg">
              로그 지우기
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
