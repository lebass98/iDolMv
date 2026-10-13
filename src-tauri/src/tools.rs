//! 앱 번들 안의 yt-dlp / ffmpeg / deno 위치 찾기
//!
//! 배포 앱:  YTDownloader.app/Contents/Resources/tools/{yt-dlp/yt-dlp, ffmpeg, deno}
//! 개발 실행: src-tauri/target/.../tools (tauri가 resources를 복사해 줌)

use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub struct ToolPaths {
    pub ytdlp: PathBuf,
    pub ffmpeg: PathBuf,
    pub deno: PathBuf,
}

pub fn paths(app: &AppHandle) -> Result<ToolPaths, String> {
    let dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("리소스 폴더를 찾을 수 없음: {e}"))?
        .join("tools");
    let p = ToolPaths {
        ytdlp: dir.join("yt-dlp").join("yt-dlp"),
        ffmpeg: dir.join("ffmpeg"),
        deno: dir.join("deno"),
    };
    for (name, path) in [("yt-dlp", &p.ytdlp), ("ffmpeg", &p.ffmpeg), ("deno", &p.deno)] {
        if !path.exists() {
            return Err(format!("{name}이(가) 앱 안에 없습니다: {}", path.display()));
        }
    }
    Ok(p)
}

/// 복사 과정에서 실행 권한이 빠졌을 때를 대비해 0755로 맞춤
pub fn ensure_executable(app: &AppHandle) {
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
