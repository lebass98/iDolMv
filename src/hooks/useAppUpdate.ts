// 새 버전이 있는지 보고, 받아서 설치하는 흐름을 한 곳에서 관리한다.
// App에서 한 번만 부르고, 그 상태를 업데이트 팝업과 설정 화면이 같이 본다.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAN_SELF_UPDATE,
  checkForUpdate,
  clearDownloadedUpdate,
  currentVersion,
  downloadUpdate,
  installUpdate,
  type AppRelease,
} from "../lib/app-update";
import { isAndroid } from "../backend";

/** 앱을 켜고 이만큼 지나야 다시 확인한다. 창을 오갈 때마다 GitHub을 부르지 않도록. */
const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;
/** 앱이 뜨자마자가 아니라 첫 화면이 자리를 잡은 뒤에 확인한다. */
const FIRST_CHECK_DELAY_MS = 2_000;

export type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing" | "error";

export interface AppUpdateState {
  phase: UpdatePhase;
  /** 새 버전 정보. 없으면 최신이라는 뜻 */
  release: AppRelease | null;
  /** 0~1 다운로드 진행률 */
  progress: number;
  error: string;
  /** 팝업이 떠 있는지 (사용자가 닫으면 그 버전으로는 이번 실행에서 다시 뜨지 않는다) */
  visible: boolean;
  currentVersion: string;
  /** manual이면 "최신입니다"도 알려 준다. 자동 확인은 조용히 지나간다. */
  check: (manual?: boolean) => Promise<void>;
  start: () => void;
  dismiss: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [version, setVersion] = useState("");
  /** 사용자가 닫은 버전. 같은 버전으로는 다시 띄우지 않는다. */
  const dismissed = useRef<string | null>(null);
  const checkedAt = useRef(0);
  const cancelDownload = useRef<(() => Promise<void>) | null>(null);
  /** 콜백이 phase에 묶이지 않게 지금 단계를 따로 들고 본다. */
  const phaseRef = useRef<UpdatePhase>("idle");
  phaseRef.current = phase;

  useEffect(() => {
    currentVersion().then(setVersion).catch(() => setVersion(""));
  }, []);

  const check = useCallback(async (manual = false) => {
    if (!CAN_SELF_UPDATE) return;
    // 내려받는 중에 새로 확인해 상태를 덮어쓰지 않는다.
    const now = phaseRef.current;
    if (now === "downloading" || now === "installing" || now === "checking") return;
    if (!manual && Date.now() - checkedAt.current < RECHECK_AFTER_MS) return;

    setPhase("checking");
    setError("");
    try {
      const found = await checkForUpdate();
      checkedAt.current = Date.now();
      setRelease(found);
      if (found && (manual || dismissed.current !== found.version)) {
        setPhase("available");
        setVisible(true);
      } else {
        setPhase("idle");
        // 자동 확인에서 최신이면 아무것도 띄우지 않는다. 직접 눌렀을 때만 팝업으로 알려 준다.
        if (manual && !found) setVisible(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason) || "확인하지 못했어요.");
      setPhase("error");
      if (manual) setVisible(true);
    }
  }, []);

  const start = useCallback(() => {
    if (!release) return;
    setPhase("downloading");
    setProgress(0);
    setError("");
    const task = downloadUpdate(release, setProgress);
    cancelDownload.current = task.cancel;
    task.promise
      .then(async (path) => {
        cancelDownload.current = null;
        setPhase("installing");
        await installUpdate(path);
        // 설치 화면은 OS가 띄운다. 설치를 마치면 앱이 새 버전으로 다시 시작한다.
      })
      .catch((reason) => {
        cancelDownload.current = null;
        const msg = reason instanceof Error ? reason.message : String(reason);
        if (msg === "취소됨") return; // '나중에'를 눌러 멈춘 것
        setError(msg || "설치를 시작하지 못했어요.");
        setPhase("error");
      });
  }, [release]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (release) dismissed.current = release.version;
    // 받다 만 파일을 캐시에 남기지 않는다.
    void cancelDownload.current?.();
    cancelDownload.current = null;
    const now = phaseRef.current;
    if (now === "downloading" || now === "error") setPhase(release ? "available" : "idle");
  }, [release]);

  // 앱을 켤 때와, 다른 창에 갔다 돌아올 때 확인한다.
  // 첫 확인은 한 박자 미룬다. 첫 화면이 그려지기 전에 상태를 건드려 다시 그리게 하지 않으려고.
  useEffect(() => {
    if (!CAN_SELF_UPDATE) return;
    const timer = setTimeout(() => void check(), FIRST_CHECK_DELAY_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  // 설치 화면까지 갔다가 돌아왔는데도 같은 버전이면(설치를 취소했다) 받아 둔 파일을 치운다.
  useEffect(() => {
    if (phase !== "installing" || !release) return;
    const onFocus = () => {
      void clearDownloadedUpdate(release.assetName);
      setPhase("available");
    };
    // 안드로이드는 설치 화면이 앱 위에 떠서 focus가 바로 돌아오므로 한 박자 늦게 본다.
    const delay = isAndroid ? 1_500 : 0;
    const timer = setTimeout(() => window.addEventListener("focus", onFocus), delay);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [phase, release]);

  return { phase, release, progress, error, visible, currentVersion: version, check, start, dismiss };
}
