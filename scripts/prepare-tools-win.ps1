# 윈도우 앱에 넣을 yt-dlp / ffmpeg / deno 준비 → src-tauri/tools-win
#
#   tools-win/yt-dlp/yt-dlp.exe   (yt-dlp 공식 윈도우 실행 파일)
#   tools-win/ffmpeg.exe, ffprobe.exe  (BtbN FFmpeg 빌드, GPL)
#   tools-win/deno.exe            (유튜브 주소 해독용 JavaScript 실행기)
#
# 사용법 (PowerShell): pwsh scripts/prepare-tools-win.ps1
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # 진행 표시줄을 끄면 다운로드가 훨씬 빠름

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "src-tauri/tools-win"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "idol-tools"

Remove-Item -Recurse -Force $out, $tmp -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $out "yt-dlp"), $tmp | Out-Null

Write-Host "▶ yt-dlp.exe"
Invoke-WebRequest "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" `
  -OutFile (Join-Path $out "yt-dlp/yt-dlp.exe")

Write-Host "▶ deno.exe"
Invoke-WebRequest "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip" `
  -OutFile (Join-Path $tmp "deno.zip")
Expand-Archive (Join-Path $tmp "deno.zip") -DestinationPath $out -Force

Write-Host "▶ ffmpeg.exe / ffprobe.exe"
Invoke-WebRequest "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" `
  -OutFile (Join-Path $tmp "ffmpeg.zip")
Expand-Archive (Join-Path $tmp "ffmpeg.zip") -DestinationPath $tmp -Force
$bin = Get-ChildItem $tmp -Recurse -Filter ffmpeg.exe | Select-Object -First 1
Copy-Item $bin.FullName, (Join-Path $bin.DirectoryName "ffprobe.exe") $out

Remove-Item -Recurse -Force $tmp
Write-Host "✅ 완료: $out"
Get-ChildItem $out -Recurse -File | ForEach-Object { "{0,10:N0} KB  {1}" -f ($_.Length / 1KB), $_.FullName.Substring($out.Length + 1) }
& (Join-Path $out "yt-dlp/yt-dlp.exe") --version
