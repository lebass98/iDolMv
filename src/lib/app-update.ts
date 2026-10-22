// 앱이 스스로 새 버전을 받아 설치하는 기능 (창 쪽).
//
// 흐름: Rust가 GitHub 릴리스에서 최신 버전을 보고 → 새 버전이면 설치 파일을 캐시에 내려받고
// → 설치 화면을 띄운다. (설치는 OS가 맡으므로 사용자가 한 번 더 누른다)
//
// 확인·다운로드는 Rust(update.rs)가 한다. 창에는 CSP가 걸려 있어 api.github.com을 직접 못 부른다.
// 설치만 플랫폼이 다르다 — 안드로이드는 Kotlin 플러그인, 맥·윈도우는 Rust.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isAndroid } from "../backend";

export interface AppRelease {
  version: string;
  assetUrl: string;
  assetName: string;
  size: number;
  notes: string;
  publishedAt: string;
}

/** 이 기능을 쓸 수 있는 기기인지. (Tauri 앱으로 깔린 맥·윈도우·안드로이드) */
export const CAN_SELF_UPDATE = true;

/** 지금 깔려 있는 버전. 빌드할 때 박힌 값이라 배포 빌드에서도 믿을 수 있다. */
export function currentVersion(): Promise<string> {
  return invoke<string>("app_version");
}

/**
 * 버전 비교. `1.10.0`이 `1.9.0`보다 높도록 점으로 끊어 숫자로 견준다.
 * 뒤에 붙은 꼬리표(1.2.0-beta.1)는 숫자가 아닌 부분부터 무시한다.
 * (Rust의 is_newer와 같은 기준 — 여기서는 화면 표시용으로만 쓴다)
 */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (value: string) => value.split(".").map((piece) => Number.parseInt(piece, 10) || 0);
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}

/** 최신 릴리스를 묻는다. 새 버전이 없으면 null. */
export function checkForUpdate(): Promise<AppRelease | null> {
  return invoke<AppRelease | null>("check_update");
}

/**
 * 설치 파일을 내려받는다. onProgress는 0~1을 받는다.
 * 돌려준 cancel을 부르면 중간에 멈추고 받다 만 파일을 지운다.
 */
export function downloadUpdate(release: AppRelease, onProgress: (ratio: number) => void) {
  const off = listen<number>("update://progress", ({ payload }) => onProgress(payload));
  const done = () => off.then((f) => f());
  return {
    promise: invoke<string>("download_update", {
      url: release.assetUrl,
      name: release.assetName,
      size: release.size,
    }).finally(done),
    cancel: async () => {
      await invoke("cancel_update").catch(() => {});
      await done();
    },
  };
}

/**
 * 설치 화면을 띄운다.
 * 안드로이드는 패키지 설치 화면, 맥은 DMG(응용 프로그램으로 끌어다 놓기), 윈도우는 설치 파일 실행.
 */
export function installUpdate(path: string): Promise<unknown> {
  return isAndroid ? invoke("plugin:ytdl|install_apk", { path }) : invoke("install_update", { path });
}

/** '출처를 알 수 없는 앱 설치' 허용 화면을 연다. 안드로이드에서 설치가 막혔을 때 안내한다. */
export function openInstallSettings(): Promise<unknown> {
  return isAndroid ? invoke("plugin:ytdl|open_install_settings") : Promise.resolve();
}

/** 설치가 끝났거나 취소된 뒤 캐시에 남은 설치 파일을 치운다. */
export function clearDownloadedUpdate(assetName: string): Promise<unknown> {
  return invoke("clear_update", { name: assetName }).catch(() => undefined);
}

/** 용량 표시 */
export function formatSize(bytes: number): string {
  if (!bytes) return "알 수 없음";
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
