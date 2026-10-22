import { Download, RefreshCw, ShieldCheck, X } from "lucide-react";
import { isAndroid } from "../backend";
import { formatSize } from "../lib/app-update";
import type { AppUpdateState } from "../hooks/useAppUpdate";

/** 새 버전이 나왔을 때 뜨는 팝업. App에 한 번만 둔다. */
export default function UpdateModal({ u }: { u: AppUpdateState }) {
  if (!u.visible) return null;

  const busy = u.phase === "downloading" || u.phase === "installing";
  const pct = Math.round(u.progress * 100);
  const title = u.error
    ? "업데이트를 가져오지 못했어요"
    : u.release
      ? `새 버전 ${u.release.version}`
      : "최신 버전이에요";
  const sub = u.error
    ? u.error
    : u.release
      ? `지금 ${u.currentVersion} · 받을 용량 ${formatSize(u.release.size)}`
      : `현재 ${u.currentVersion}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-8 backdrop-blur-sm"
      onClick={busy ? undefined : u.dismiss}
    >
      <div
        className="panel w-full max-w-sm overflow-hidden"
        role="alertdialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            {u.error ? <RefreshCw className="h-5 w-5" /> : u.release ? <Download className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold leading-6">{title}</p>
            <p className="mt-1 text-[13px] leading-5 text-muted">{sub}</p>
          </div>
          {!busy && (
            <button onClick={u.dismiss} title="닫기" className="btn-ghost flex h-8 w-8 shrink-0 items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 릴리스 설명(변경 내용). 길면 안에서 스크롤된다. */}
        {!u.error && !!u.release?.notes && (
          <div className="field mx-6 mt-4 max-h-44 overflow-y-auto p-3">
            <p className="whitespace-pre-wrap text-[12.5px] leading-5 text-fg/80">{u.release.notes}</p>
          </div>
        )}

        {busy && (
          <div className="mx-6 mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              {u.phase === "installing" ? "설치 화면을 여는 중…" : `내려받는 중 ${pct}%`}
            </p>
          </div>
        )}

        {u.phase === "installing" && (
          <p className="mx-6 mt-3 text-center text-xs leading-5 text-muted">
            {isAndroid
              ? "설치가 막히면 ‘이 출처 허용’을 켠 뒤 다시 눌러 주세요."
              : "열린 창에서 앱을 응용 프로그램 폴더로 끌어다 놓고, 이 앱을 다시 켜 주세요."}
          </p>
        )}

        <div className="flex gap-2 px-6 pb-6 pt-5">
          <button
            onClick={u.dismiss}
            disabled={busy}
            className="btn-ghost h-11 flex-1 text-[15px] font-bold disabled:opacity-40"
          >
            {u.release && !busy ? "나중에" : "닫기"}
          </button>
          {!!u.release && (
            <button
              onClick={u.start}
              disabled={busy}
              className="btn-accent h-11 flex-1 !rounded-xl text-[15px] font-bold disabled:opacity-40"
            >
              {u.error ? "다시 시도" : "업데이트"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
