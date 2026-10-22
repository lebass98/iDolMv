# 앱 자동 업데이트

설치 파일을 받아 설치하는 일을 앱이 대신한다. 새 버전을 GitHub 릴리스에 올려 두면, 기기가 알아서 보고 알려 준다.

맥·윈도우·안드로이드 모두 같은 흐름이다. 설치 마지막 한 번만 OS가 맡는다.

| 플랫폼 | 받는 것 | 설치 |
|---|---|---|
| 안드로이드 | `…-android.apk` | 패키지 설치 화면 (앱이 띄움) |
| 맥 | `…-mac.dmg` | DMG를 Finder로 열고 응용 프로그램 폴더로 끌어다 놓기 |
| 윈도우 | `…-windows-setup.exe` | 설치 파일을 그대로 실행 |

## 쓰는 쪽

- 앱을 켜면(첫 화면이 뜬 2초 뒤) 그리고 다른 창에 갔다 돌아오면 새 버전이 있는지 확인한다. 같은 확인을 6시간 안에 또 하지는 않는다.
- 새 버전이 있으면 팝업이 뜬다. **업데이트**를 누르면 앱 안에서 설치 파일을 받고(진행률 표시) 설치 화면이 열린다.
- **나중에**를 누르면 그 버전으로는 이번 실행 동안 다시 뜨지 않는다. 앱을 다시 켜면 또 알려 준다.
- 설정 → **앱 버전**을 누르면 언제든 직접 확인할 수 있다. 최신이면 "최신 버전이에요"라고 알려 준다.

## 내는 쪽

```bash
bash scripts/release.sh 1.1.0 "차트 갱신 속도 개선"
```

스크립트(`scripts/release.sh`)가 차례로 한다.

1. `scripts/set-version.sh` — `package.json`·`src-tauri/Cargo.toml`·`src-tauri/tauri.conf.json`의 버전을 1.1.0으로 맞춤
2. `npx tauri build --bundles dmg` — 맥 DMG
3. `bash scripts/android-build.sh release` — 서명된 안드로이드 APK
4. `gh release create v1.1.0 …` — 두 파일을 올림

태그가 올라가면 GitHub Actions(`.github/workflows/windows.yml`)가 윈도우 설치 파일을 **같은 릴리스**에 몇 분 뒤 붙인다.

필요한 것: Android SDK·NDK, JDK 17, Rust, `gh` 로그인, 서명 키(`~/build/idol-release.keystore`).
변경 내용으로 적은 글이 그대로 팝업에 보인다.

버전은 `1.2.3` 꼴이어야 한다. 앱이 점으로 끊어 숫자로 견주므로 `1.10.0`이 `1.9.0`보다 높다.

## 어떻게 움직이나

저장소가 **공개**라서 중계 서버 없이 GitHub API를 바로 쓴다. 파일도 GitHub에서 기기로 바로 내려온다.

```
창(JS)                        Rust (src-tauri/src/update.rs)
useAppUpdate()  ──check───▶   api.github.com/…/releases/latest
                              → 태그에서 버전을 꺼내 지금 버전과 견줌
                              → 이 플랫폼의 파일 이름 끝부분으로 골라 돌려줌
                ──download─▶  캐시 폴더로 내려받기 (진행률은 update://progress)
                ──install──▶  맥: open / 윈도우: 실행
                              안드로이드: plugin:ytdl|install_apk (Kotlin)
```

창에는 CSP가 걸려 있어 `api.github.com`을 직접 부를 수 없으므로 확인·다운로드를 Rust가 맡는다.

| 파일 | 하는 일 |
|---|---|
| `src-tauri/src/update.rs` | 릴리스 확인, 설치 파일 내려받기·취소·정리, 맥·윈도우 설치 실행 |
| `src/lib/app-update.ts` | 위 명령을 부르는 얇은 껍데기, 버전 비교, 용량 표시 |
| `src/hooks/useAppUpdate.ts` | 언제 확인할지, 팝업을 띄울지 말지 |
| `src/components/UpdateModal.tsx` | 팝업 |
| `plugins/tauri-plugin-ytdl` | 안드로이드 패키지 설치 화면 (`install_apk`) |

앱이 자기 것을 고르는 기준은 **파일 이름의 끝부분**이다 (`update.rs`의 `asset_suffix`).
릴리스에 올리는 이름을 바꾸면 여기도 같이 바꿔야 한다.

미리 보기(pre-release)는 `releases/latest`가 걸러 준다. 그래서 main 브랜치마다 올라가는
윈도우 `windows-latest` 빌드는 업데이트로 내려가지 않는다.

## 알아 둘 것

- **안드로이드는 서명이 같아야 깔린다.** 릴리스 APK는 `~/build/idol-release.keystore`로 서명한다.
  이 키를 바꾸면 기기에서 앱을 **지우고** 새로 깔아야 한다.
- 안드로이드에서는 **'출처를 알 수 없는 앱' 허용**이 필요하다. 꺼져 있으면 앱이 그 설정 화면을 먼저 열어 준다.
- 맥 DMG는 공증(notarize)을 하지 않았다. 처음 열 때 Gatekeeper가 막으면 우클릭 → 열기로 한 번 허용해야 한다.
- 받다 만 파일과 설치를 취소한 파일은 캐시에서 지운다. 기기에 쌓이지 않는다.
