# Idol MV 4K Downloader

음원 차트(써클차트·아이돌차트)에서 곡이나 가수를 골라, 유튜브에서 **실제 4K(2160p) 화질이 있는 뮤직비디오만** 찾아 받는 맥·안드로이드 앱입니다.

- **맥:** Tauri v2 데스크톱 앱 (DMG)
- **안드로이드:** 같은 코드로 만든 APK. 휴대폰·폴드 펼침·태블릿 화면에 맞춰 배치가 바뀝니다.
- **윈도우:** GitHub Actions에서 설치 파일(.exe)을 빌드해 [Releases](../../releases/tag/windows-latest)에 올립니다.

## 기능

- **차트 두 가지**
  - 써클차트 디지털 차트: 주간·월간·연간 200곡 (앨범 표지, 순위 변동)
  - 아이돌차트 랭킹: 실시간·주간·월간·연간 전체 순위 + 내장 장르 사전
- **장르 분류:** 걸그룹, 보이그룹, 여자/남자 솔로, 혼성, 힙합, 트로트, 밴드, 발라드·R&B
- **4K 검색:** yt-dlp로 검색한 뒤 포맷 목록에 2160p 이상이 있는 영상만 표시 (조회수·등록일·예상 크기, 다양한 정렬)
- **다운로드:** 4K 영상 + 최고 음질을 ffmpeg로 병합(MP4/MKV), 대기열 순차 다운로드, 실시간 진행률·속도·남은 시간, 취소, 403 오류 자동 재시도
- **이미 받은 영상 표시**, 다운로드 히스토리, 설정(테마·저장 위치·검색 개수)
- **자동 업데이트:** 새 버전이 나오면 앱이 알려 주고, 앱 안에서 받아 설치까지 이어 줍니다 (맥·윈도우·안드로이드) → [docs/app-update.md](docs/app-update.md)
- **다크 / 화이트 모드**

## 구조

```
src/                       React + TypeScript + Tailwind 화면
  backend.ts               맥(Rust 명령) / 안드로이드(Kotlin 플러그인) 분기
  components/              차트·검색 결과·다운로드·히스토리·설정 패널
  lib/app-update.ts        업데이트 명령 껍데기·버전 비교
  hooks/useAppUpdate.ts    언제 확인하고 팝업을 띄울지
src-tauri/src/
  chart.rs                 아이돌차트 스크래핑 (전체 페이지)
  circle.rs                써클차트 데이터 요청
  artists.rs               아티스트 장르 사전
  search.rs                yt-dlp 4K 검색 (맥)
  ytdlp.rs                 다운로드·취소·이미 받은 영상 확인 (맥)
  update.rs                새 버전 확인·설치 파일 내려받기·설치 실행
plugins/tauri-plugin-ytdl/ 안드로이드 다운로드 엔진 (youtubedl-android, Kotlin)
scripts/
  prepare-tools.sh         맥 앱에 넣을 yt-dlp·ffmpeg·deno 준비
  android-build.sh         안드로이드 APK 빌드·서명
  release.sh               버전 올리기 → 맥·안드로이드 빌드 → GitHub 릴리스
  set-version.sh           세 파일의 버전을 한꺼번에 맞춤
```

## 빌드

### 맥

```bash
npm install
bash scripts/prepare-tools.sh      # ~/build/yttools/out 에 yt-dlp·ffmpeg·deno 준비
npx tauri build --bundles app
```

`src-tauri/tauri.conf.json`의 `bundle.resources`가 `~/build/yttools/out`을 가리킵니다.
빌드 결과물 위치는 `src-tauri/.cargo/config.toml`에서 정합니다 (외장하드 exFAT의 `._` 파일 문제를 피하려고 내장 디스크 사용).

### 안드로이드

필요: JDK 17, Android SDK(플랫폼 35·36, 빌드 도구, NDK), Rust `aarch64-linux-android` 대상

```bash
bash scripts/android-build.sh          # 배포용 (서명 키: ~/build/idol-release.keystore)
bash scripts/android-build.sh debug    # 디버그
```

소스를 `~/build/idol-mobile`로 동기화한 뒤 거기서 빌드하고, 결과를 프로젝트 상위 폴더에 `IdolMV4K-android.apk`로 복사합니다.

### 윈도우

`main` 브랜치에 올리면 GitHub Actions(`.github/workflows/windows.yml`)가 자동으로:

1. `scripts/prepare-tools-win.ps1` — 공식 배포처에서 yt-dlp.exe·ffmpeg.exe·deno.exe를 받아 `src-tauri/tools-win`에 준비
2. `scripts/smoke-test-win.ps1` — 앱과 같은 옵션으로 4K 검색과 앞 5초 다운로드 확인 (빌드 서버 IP를 유튜브가 막으면 실패할 수 있어 결과만 기록)
3. `npx tauri build` — NSIS 설치 파일 생성 (`src-tauri/tauri.windows.conf.json`)
4. Releases의 `windows-latest`에 `IdolMV4K-windows-setup.exe`로 올림

윈도우 PC에서 직접 빌드할 때는 `pwsh scripts/prepare-tools-win.ps1` 후 `npx tauri build`.

## 배포 (새 버전 내기)

```bash
bash scripts/release.sh 1.1.0 "차트 갱신 속도 개선"
```

버전을 세 파일에 맞추고, 맥 DMG와 안드로이드 APK를 빌드해 `v1.1.0` 릴리스로 올립니다.
태그가 올라가면 Actions가 윈도우 설치 파일을 같은 릴리스에 붙입니다.
기기의 앱은 이 릴리스를 보고 스스로 업데이트합니다. 자세한 내용은 [docs/app-update.md](docs/app-update.md).

## 참고

- 받은 뮤직비디오는 저작권이 있으니 개인 소장 용도로만 쓰세요.
- 4K 영상은 대부분 VP9/AV1 코덱이라 맥 기본 플레이어(QuickTime)에서 안 열릴 수 있습니다 (IINA·VLC 권장).
- 차트 사이트 구조가 바뀌면 `chart.rs` / `circle.rs`를 고쳐야 합니다.

## 변경 기록

### 2026-10-22 (1.1.0)
- 자동 업데이트: GitHub 릴리스를 보고 새 버전을 알려 주고, 앱 안에서 받아 설치까지 이어 줌
  - 앱을 켤 때·창으로 돌아올 때 확인 (6시간 간격), 설정 → 앱 버전에서 직접 확인
  - 안드로이드는 패키지 설치 화면, 맥은 DMG, 윈도우는 설치 파일 실행
- `scripts/release.sh`로 버전 올리기·빌드·릴리스를 한 번에
- 버전 태그를 올리면 Actions가 윈도우 설치 파일을 같은 릴리스에 붙임

### 2026-10-14 (윈도우)
- 윈도우 지원: 탐색기에서 보기, taskkill로 취소, 실행 시 콘솔 창 숨김, `.exe` 도구 경로
- GitHub Actions 윈도우 빌드·도구 동작 확인·Releases 자동 업로드
- 타이틀바 왼쪽 여백(맥 신호등 버튼 자리)은 맥에서만

### 2026-10-14
- 안드로이드 APK 지원: youtubedl-android 기반 Kotlin 플러그인, 휴대폰용 아래 탭 화면
- Z 폴드 펼침 등 중간 크기 화면(821~1279px)용 배치 추가: 아이콘 메뉴 + 검색 결과/다운로드 전환 탭
- 안드로이드 배포용 빌드에서 앱이 바로 꺼지던 문제 수정 (R8 압축 제외 규칙)
- 안드로이드 상태바와 타이틀바가 겹치던 문제 수정

### 2026-10-13
- 첫 버전: 아이돌차트 스크래핑 + 4K MV 검색·일괄 다운로드
- 모두 선택 버튼, 장르 분류·정렬, 차트 전체 순위
- 이미 받은 영상 "다운로드됨" 표시, 403 오류 자동 재시도
- 써클차트 탭 추가, 다크/화이트 모드
- 시안에 맞춘 디자인 변경, 히스토리·설정 화면
