//! 앱 번들 안의 yt-dlp / ffmpeg / deno 위치 찾기
//!
//! 맥:     Idol MV 4K Downloader.app/Contents/Resources/tools/{yt-dlp/yt-dlp, ffmpeg, deno}
//! 윈도우: 설치 폴더/tools/{yt-dlp/yt-dlp.exe, ffmpeg.exe, deno.exe}
//! 개발 실행: target/.../tools (tauri가 resources를 복사해 줌)

use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

pub struct ToolPaths {
    pub ytdlp: PathBuf,
    pub ffmpeg: PathBuf,
    pub deno: PathBuf,
}

/// 실행 파일 이름 (윈도우는 .exe)
fn exe(name: &str) -> String {
    if cfg!(windows) { format!("{name}.exe") } else { name.to_string() }
}

pub fn paths(app: &AppHandle) -> Result<ToolPaths, String> {
    let dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("리소스 폴더를 찾을 수 없음: {e}"))?
        .join("tools");
    let p = ToolPaths {
        ytdlp: dir.join("yt-dlp").join(exe("yt-dlp")),
        ffmpeg: dir.join(exe("ffmpeg")),
        deno: dir.join(exe("deno")),
    };
    for (name, path) in [("yt-dlp", &p.ytdlp), ("ffmpeg", &p.ffmpeg), ("deno", &p.deno)] {
        if !path.exists() {
            return Err(format!("{name}이(가) 앱 안에 없습니다: {}", path.display()));
        }
    }
    Ok(p)
}

/// 외부 도구 실행용 Command (윈도우: 실행할 때마다 콘솔 창이 깜빡이지 않게 숨김)
pub fn command(program: impl AsRef<Path>) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program.as_ref());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// 복사 과정에서 실행 권한이 빠졌을 때를 대비해 0755로 맞춤 (윈도우는 필요 없음)
pub fn ensure_executable(app: &AppHandle) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let Ok(p) = paths(app) else { return };
        for path in [&p.ytdlp, &p.ffmpeg, &p.deno] {
            if let Ok(meta) = std::fs::metadata(path) {
                let mut perm = meta.permissions();
                if perm.mode() & 0o111 == 0 {
                    perm.set_mode(0o755);
                    let _ = std::fs::set_permissions(path, perm);
                }
            }
        }
    }
    #[cfg(not(unix))]
    let _ = app;
}
