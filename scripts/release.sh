#!/usr/bin/env bash
# 새 버전을 찍어 GitHub 릴리스에 올린다. 앱은 이 릴리스를 보고 스스로 업데이트한다.
#
#   bash scripts/release.sh 1.1.0 "차트 갱신 속도 개선"
#
# 하는 일: 버전 올리기 → 맥 DMG·안드로이드 APK 빌드 → gh release 생성.
#          태그가 올라가면 GitHub Actions가 윈도우 설치 파일을 같은 릴리스에 붙인다.
# 필요한 것: Android SDK·NDK, JDK 17, Rust, gh CLI 로그인, 서명 키(~/build/idol-release.keystore)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

VERSION="${1:-}"
NOTES="${2:-}"
if [[ -z "$VERSION" ]]; then
  echo "사용법: $0 <버전> [변경 내용]   예) $0 1.1.0 \"차트 갱신 속도 개선\"" >&2
  exit 1
fi
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "버전은 1.2.3 꼴이어야 해요. (앱이 점으로 끊어 숫자로 견줍니다)" >&2
  exit 1
fi

# 1) 세 곳의 버전을 한꺼번에 맞춘다. 앱에 박히는 값은 Cargo.toml이다(update.rs의 CARGO_PKG_VERSION).
bash scripts/set-version.sh "$VERSION"

# 2) 맥: DMG (앱이 받아서 Finder로 열면 응용 프로그램에 끌어다 놓는 그 창이 뜬다)
echo "▶ 맥 DMG 빌드"
npx tauri build --bundles dmg
DMG="$(ls -t src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null | head -1 || true)"
[[ -n "$DMG" ]] || DMG="$(ls -t "$HOME"/build/yt-idol/target/release/bundle/dmg/*.dmg | head -1)"
[[ -f "$DMG" ]] || { echo "DMG를 찾지 못했어요." >&2; exit 1; }

# 3) 안드로이드: 서명된 릴리스 APK
echo "▶ 안드로이드 APK 빌드"
bash scripts/android-build.sh release
APK="$ROOT/../IdolMV4K-android.apk"
[[ -f "$APK" ]] || { echo "APK를 찾지 못했어요: $APK" >&2; exit 1; }

# 4) 릴리스에 올린다. 파일 이름의 끝부분으로 앱이 자기 것을 고른다 (update.rs의 asset_suffix).
OUT="$(mktemp -d)"
cp "$DMG" "$OUT/IdolMV4K-${VERSION}-mac.dmg"
cp "$APK" "$OUT/IdolMV4K-${VERSION}-android.apk"

echo "▶ GitHub 릴리스 v${VERSION}"
gh release create "v${VERSION}" \
  "$OUT/IdolMV4K-${VERSION}-mac.dmg" \
  "$OUT/IdolMV4K-${VERSION}-android.apk" \
  --title "v${VERSION}" \
  --notes "${NOTES:-새 버전이 나왔어요.}"
rm -rf "$OUT"

echo "✅ 완료. 윈도우 설치 파일은 Actions가 몇 분 뒤 같은 릴리스에 붙입니다."
echo "   기기에서 설정 → 앱 버전 → 업데이트 확인을 누르면 바로 보여요."
