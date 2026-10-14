#!/bin/bash
# 안드로이드 APK 빌드
#
# 외장하드(exFAT)에서는 macOS가 만드는 ._ 숨김 파일 때문에 Gradle 빌드가 깨져서,
# 소스를 내장 디스크(~/build/idol-mobile)로 동기화한 뒤 거기서 빌드함.
#
# 사용법: bash scripts/android-build.sh [debug|release]   (기본: release)
#   결과: <프로젝트>/../IdolMV4K-android.apk
set -euo pipefail

MODE="${1:-release}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$HOME/build/idol-mobile"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export NDK_HOME="$(ls -d "$ANDROID_HOME"/ndk/* | sort -V | tail -1)"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "▶ 소스 동기화 → $WORK"
mkdir -p "$WORK"
COPYFILE_DISABLE=1 rsync -a --delete \
  --exclude node_modules --exclude dist --exclude dist-apps --exclude "._*" --exclude ".DS_Store" \
  --exclude "src-tauri/gen/android" --exclude "src-tauri/target" \
  "$SRC/" "$WORK/"

cd "$WORK"
[ -d node_modules ] || npm install --no-audit --no-fund

# 데스크톱 빌드 결과물 폴더 설정(.cargo/config.toml)은 안드로이드 빌드와 섞이지 않게 분리
mkdir -p src-tauri/.cargo
printf '[build]\ntarget-dir = "%s"\n' "$HOME/build/idol-mobile-target" > src-tauri/.cargo/config.toml

# 맥용 yt-dlp·ffmpeg 번들은 안드로이드에 필요 없음 (용량만 차지)
python3 - <<'PY'
import json
p = "src-tauri/tauri.conf.json"
c = json.load(open(p, encoding="utf-8"))
c["bundle"].pop("resources", None)
json.dump(c, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PY

if [ ! -d src-tauri/gen/android ]; then
  echo "▶ 안드로이드 프로젝트 생성"
  npx tauri android init --ci
fi

# youtubedl-android는 .so 파일을 압축 해제된 상태로 써야 함 → legacy packaging
APP_GRADLE=src-tauri/gen/android/app/build.gradle.kts
if ! grep -q "useLegacyPackaging" "$APP_GRADLE"; then
  cat >> "$APP_GRADLE" <<'EOF'

// youtubedl-android: 파이썬·ffmpeg 네이티브 라이브러리를 압축 해제해서 설치
android {
    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }
}
EOF
fi

echo "▶ APK 빌드 ($MODE)"
if [ "$MODE" = "debug" ]; then
  npx tauri android build --apk --debug --target aarch64
  APK=$(ls -t src-tauri/gen/android/app/build/outputs/apk/*/debug/*.apk | head -1)
else
  npx tauri android build --apk --target aarch64
  APK=$(ls -t src-tauri/gen/android/app/build/outputs/apk/*/release/*.apk | head -1)
fi

# 배포용(release) APK는 서명해야 설치됨 → 로컬 키(~/build/idol-release.keystore)로 서명
OUT="$SRC/../IdolMV4K-android.apk"
if [ "$MODE" != "debug" ]; then
  KS="$HOME/build/idol-release.keystore"
  BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
  "$BT/zipalign" -f -p 4 "$APK" "$WORK/aligned.apk"
  "$BT/apksigner" sign --ks "$KS" --ks-pass pass:idolmv4k --key-pass pass:idolmv4k --out "$WORK/signed.apk" "$WORK/aligned.apk"
  "$BT/apksigner" verify "$WORK/signed.apk"
  APK="$WORK/signed.apk"
fi
COPYFILE_DISABLE=1 cp "$APK" "$OUT"
rm -f "$(dirname "$OUT")/._$(basename "$OUT")"

echo "✅ 완료: $OUT"
