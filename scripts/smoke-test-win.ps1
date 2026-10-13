# 윈도우 도구 동작 확인: 앱과 같은 옵션으로 4K 검색 + 앞 5초 다운로드
#
# 주의: GitHub 빌드 서버(데이터센터 IP)는 유튜브가 "봇 확인"으로 막는 경우가 있어
#       여기서 실패해도 실제 PC에서는 될 수 있음 → 워크플로에서는 실패해도 빌드는 계속함
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$t = Join-Path $root "src-tauri/tools-win"
$ytdlp = Join-Path $t "yt-dlp/yt-dlp.exe"
$common = @("--no-playlist", "--js-runtimes", "deno:$(Join-Path $t 'deno.exe')", "--remote-components", "ejs:github")

Write-Host "▶ 4K 검색: RESCENE Deja Vu MV 4K"
$lines = & $ytdlp @common -j --no-warnings --ignore-errors "ytsearch3:RESCENE Deja Vu MV 4K"
$found = @()
foreach ($l in $lines) {
  try { $v = $l | ConvertFrom-Json } catch { continue }
  $max = ($v.formats | Where-Object { $_.vcodec -and $_.vcodec -ne "none" } | Measure-Object -Property height -Maximum).Maximum
  Write-Host ("  {0,5}p  {1}" -f $max, $v.title)
  if ($max -ge 2160) { $found += $v }
}
if ($found.Count -eq 0) { throw "4K 영상을 찾지 못했습니다" }
Write-Host "  → 4K $($found.Count)개"

Write-Host "▶ 앞 5초 4K 다운로드 + ffmpeg 병합"
$dl = Join-Path ([System.IO.Path]::GetTempPath()) "idol-smoke"
Remove-Item -Recurse -Force $dl -ErrorAction SilentlyContinue
& $ytdlp @common --ffmpeg-location (Join-Path $t "ffmpeg.exe") `
  -f "bv*[height>=2160]+ba/bv*+ba/b" -S "res,fps" --merge-output-format mp4 `
  --download-sections "*0-5" -o "$dl/%(id)s.%(ext)s" $found[0].webpage_url
$file = Get-ChildItem $dl -Filter *.mp4 | Select-Object -First 1
if (-not $file) { throw "다운로드한 파일이 없습니다" }
$res = & (Join-Path $t "ffprobe.exe") -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 $file.FullName
Write-Host "  → $($file.Name): $res"
if ($res -notmatch "^3840,2160") { throw "4K가 아닙니다: $res" }
Write-Host "✅ 윈도우 도구 확인 완료"
