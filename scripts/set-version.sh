#!/usr/bin/env bash
# 버전을 package.json · Cargo.toml · tauri.conf.json 세 곳에 똑같이 적는다.
# 앱에 박혀 업데이트 비교에 쓰이는 값은 Cargo.toml이다 (update.rs의 CARGO_PKG_VERSION).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:?사용법: $0 <버전>}"

python3 - "$VERSION" <<'PY'
import json, pathlib, re, sys
version = sys.argv[1]

for path in ("package.json", "src-tauri/tauri.conf.json"):
    p = pathlib.Path(path)
    data = json.loads(p.read_text(encoding="utf-8"))
    data["version"] = version
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Cargo.toml은 [package]의 version 한 줄만 바꾼다 (의존성 버전을 건드리지 않게)
p = pathlib.Path("src-tauri/Cargo.toml")
text = p.read_text(encoding="utf-8")
text, n = re.subn(r'(?m)^version = ".*"$', f'version = "{version}"', text, count=1)
assert n == 1, "Cargo.toml의 version 줄을 찾지 못했어요."
p.write_text(text, encoding="utf-8")
print(f"버전 → {version} (package.json, tauri.conf.json, Cargo.toml)")
PY
