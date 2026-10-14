#!/bin/bash
# 앱 번들에 넣을 yt-dlp / ffmpeg / deno 준비 → ~/build/yttools/out
# (외장하드 exFAT의 ._ 파일이 섞이지 않도록 내장 디스크에 만듦)
set -euo pipefail

VENV="$HOME/.venvs/ytdl"
OUT="$HOME/build/yttools/out"
WORK="$HOME/build/yttools"

# 사용 가능한 python3 자동 탐지 (3.12 이상 선호)
pick_python() {
  for c in /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.13 \
           /opt/homebrew/bin/python3.14 /usr/bin/python3 "$(command -v python3 || true)"; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  echo "python3를 찾을 수 없습니다." >&2; exit 1
}

if [ ! -x "$VENV/bin/python" ]; then
  "$(pick_python)" -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --upgrade pip "yt-dlp[default]" imageio-ffmpeg deno pyinstaller

mkdir -p "$WORK"
cd "$WORK"
printf 'import sys\nfrom yt_dlp import main\nif __name__ == "__main__":\n    sys.exit(main())\n' > ytdlp_entry.py

echo "▶ yt-dlp 단독 실행 파일 빌드"
"$VENV/bin/pyinstaller" --noconfirm --onedir --name yt-dlp \
  --collect-all yt_dlp --collect-all yt_dlp_ejs ytdlp_entry.py >/dev/null

rm -rf "$OUT" && mkdir -p "$OUT"
cp -R dist/yt-dlp "$OUT/yt-dlp"
cp "$("$VENV/bin/python" -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')" "$OUT/ffmpeg"
cp "$VENV/bin/deno" "$OUT/deno"
chmod 755 "$OUT/ffmpeg" "$OUT/deno" "$OUT/yt-dlp/yt-dlp"

echo "✅ 완료: $OUT  (yt-dlp $("$OUT/yt-dlp/yt-dlp" --version))"
