import { Download, FolderOpen, Moon, RefreshCw, Sun } from "lucide-react";
import type { ReactNode } from "react";
import type { AppUpdateState } from "../hooks/useAppUpdate";

interface Counts {
  artist: number;
  song: number;
}

interface Props {
  theme: "dark" | "light";
  container: string;
  folder: string;
  counts: Counts;
  onTheme: (t: "dark" | "light") => void;
  onContainer: (c: string) => void;
  canChangeFolder: boolean;
  onChangeFolder: () => void;
  onCounts: (c: Counts) => void;
  update: AppUpdateState;
}

function Row({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-6 border-b border-line py-5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field flex gap-1 !rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${
            value === o.v ? "btn-accent" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumberStepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="field flex items-center !rounded-full p-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-8 w-8 rounded-full text-lg text-muted hover:bg-surface hover:text-fg"
      >
        −
      </button>
      <span className="w-10 text-center text-sm font-bold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-8 w-8 rounded-full text-lg text-muted hover:bg-surface hover:text-fg"
      >
        +
      </button>
    </div>
  );
}

/** 업데이트 중에는 확인 버튼을 막는다. */
function busy(u: AppUpdateState) {
  return u.phase === "checking" || u.phase === "downloading" || u.phase === "installing";
}

/** 버전 줄에 보일 설명 */
function versionDesc(u: AppUpdateState) {
  const now = u.currentVersion ? `현재 ${u.currentVersion}` : "버전 확인 중";
  if (u.release) return `${now} · 새 버전 ${u.release.version}이 나왔어요`;
  if (u.phase === "error" && u.error) return `${now} · ${u.error}`;
  return `${now} · 눌러서 새 버전이 있는지 확인합니다`;
}

export default function SettingsView(p: Props) {
  return (
    <section className="panel flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="px-8 pb-2 pt-5">
        <h2 className="text-[22px] font-bold tracking-tight">설정</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="max-w-2xl">
          <Row title="화면 테마" desc="다크 모드와 화이트 모드 중에서 고릅니다.">
            <Segment
              value={p.theme}
              onChange={p.onTheme}
              options={[
                { v: "light", label: <><Sun className="h-4 w-4" /> 화이트</> },
                { v: "dark", label: <><Moon className="h-4 w-4" /> 다크</> },
              ]}
            />
          </Row>
          <Row title="저장 위치" desc={p.folder}>
            {p.canChangeFolder ? (
              <button onClick={p.onChangeFolder} className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm font-semibold">
                <FolderOpen className="h-4 w-4" /> 변경
              </button>
            ) : (
              <span className="text-xs text-muted">안드로이드는 고정</span>
            )}
          </Row>
          <Row title="병합 형식" desc="4K 영상과 소리를 합쳐 저장할 파일 형식입니다. MKV는 맥 기본 플레이어에서 안 열릴 수 있습니다.">
            <Segment
              value={p.container}
              onChange={p.onContainer}
              options={[
                { v: "mp4", label: "MP4" },
                { v: "mkv", label: "MKV" },
              ]}
            />
          </Row>
          <Row title="곡당 검색 개수" desc="써클차트 곡 하나당 유튜브에서 확인할 영상 수입니다. 많을수록 느려집니다.">
            <NumberStepper value={p.counts.song} min={1} max={10} onChange={(n) => p.onCounts({ ...p.counts, song: n })} />
          </Row>
          <Row title="가수당 검색 개수" desc="아이돌차트 가수 한 명당 유튜브에서 확인할 영상 수입니다. 한 개에 약 2초 걸립니다.">
            <NumberStepper value={p.counts.artist} min={1} max={20} onChange={(n) => p.onCounts({ ...p.counts, artist: n })} />
          </Row>
          <Row title="앱 버전" desc={versionDesc(p.update)}>
            <button
              // 새 버전을 이미 찾아 둔 상태면 다시 확인하지 않고 팝업을 연다.
              // (팝업의 '업데이트'를 눌러야 받기가 시작되므로, 여기서 check를 다시 부르면 제자리걸음이었다)
              onClick={() => (p.update.release ? p.update.show() : void p.update.check(true))}
              disabled={busy(p.update)}
              className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              {p.update.release ? <Download className="h-4 w-4" /> : <RefreshCw className={`h-4 w-4 ${p.update.phase === "checking" ? "animate-spin" : ""}`} />}
              {p.update.phase === "checking" ? "확인 중…" : p.update.release ? "새 버전 보기" : "업데이트 확인"}
            </button>
          </Row>
        </div>
      </div>
    </section>
  );
}
