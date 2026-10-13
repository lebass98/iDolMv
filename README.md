# Idol MV 4K Downloader

음원 차트(써클차트·아이돌차트)에서 곡이나 가수를 골라, 유튜브에서 **실제 4K(2160p) 화질이 있는 뮤직비디오만** 찾아 받는 맥·안드로이드 앱입니다.

- **맥:** Tauri v2 데스크톱 앱 (DMG)
- **안드로이드:** 같은 코드로 만든 APK. 휴대폰·폴드 펼침·태블릿 화면에 맞춰 배치가 바뀝니다.

## 기능

- **차트 두 가지**
  - 써클차트 디지털 차트: 주간·월간·연간 200곡 (앨범 표지, 순위 변동)
  - 아이돌차트 랭킹: 실시간·주간·월간·연간 전체 순위 + 내장 장르 사전
- **장르 분류:** 걸그룹, 보이그룹, 여자/남자 솔로, 혼성, 힙합, 트로트, 밴드, 발라드·R&B
- **4K 검색:** yt-dlp로 검색한 뒤 포맷 목록에 2160p 이상이 있는 영상만 표시 (조회수·등록일·예상 크기, 다양한 정렬)
- **다운로드:** 4K 영상 + 최고 음질을 ffmpeg로 병합(MP4/MKV), 대기열 순차 다운로드, 실시간 진행률·속도·남은 시간, 취소, 403 오류 자동 재시도
- **이미 받은 영상 표시**, 다운로드 히스토리, 설정(테마·저장 위치·검색 개수)
- **다크 / 화이트 모드**

## 구조

```
src/                       React + TypeScript + Tailwind 화면
  backend.ts               맥(Rust 명령) / 안드로이드(Kotlin 플러그인) 분기
  components/              차트·검색 결과·다운로드·히스토리·설정 패널
src-tauri/src/
  chart.rs                 아이돌차트 스크래핑 (전체 페이지)
  circle.rs                써클차트 데이터 요청
  artists.rs               아티스트 장르 사전
  search.rs                yt-dlp 4K 검색 (맥)
  ytdlp.rs                 다운로드·취소·이미 받은 영상 확인 (맥)
plugins/tauri-plugin-ytdl/ 안드로이드 다운로드 엔진 (youtubedl-android, Kotlin)
scripts/
  prepare-tools.sh         맥 앱에 넣을 yt-dlp·ffmpeg·deno 준비
  android-build.sh         안드로이드 APK 빌드·서명
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

## 참고

- 받은 뮤직비디오는 저작권이 있으니 개인 소장 용도로만 쓰세요.
- 4K 영상은 대부분 VP9/AV1 코덱이라 맥 기본 플레이어(QuickTime)에서 안 열릴 수 있습니다 (IINA·VLC 권장).
- 차트 사이트 구조가 바뀌면 `chart.rs` / `circle.rs`를 고쳐야 합니다.

## 변경 기록

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
