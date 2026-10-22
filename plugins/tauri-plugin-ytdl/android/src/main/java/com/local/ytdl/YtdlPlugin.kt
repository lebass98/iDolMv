package com.local.ytdl

import android.app.Activity
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import org.json.JSONObject
import java.io.File

@InvokeArg
class SearchArgs {
    lateinit var query: String
    var count: Int = 6
    lateinit var onEvent: Channel
}

@InvokeArg
class DownloadArgs {
    lateinit var id: String
    lateinit var url: String
    var title: String = ""
    lateinit var folder: String
    var container: String = "mp4"
    lateinit var onEvent: Channel
}

@InvokeArg
class IdArgs {
    lateinit var id: String
}

@InvokeArg
class FolderArgs {
    lateinit var folder: String
}

@InvokeArg
class PathArgs {
    lateinit var path: String
}

@TauriPlugin
class YtdlPlugin(private val activity: Activity) : Plugin(activity) {
    @Volatile private var ready = false
    private val lock = Object()

    /** yt-dlp 공통 옵션: EJS 스크립트(유튜브 주소 해독)는 GitHub에서 받아 씀 */
    private fun YoutubeDLRequest.common(): YoutubeDLRequest {
        addOption("--no-playlist")
        addOption("--remote-components", "ejs:github")
        return this
    }

    private fun ensureReady() {
        synchronized(lock) {
            if (ready) return
            YoutubeDL.getInstance().init(activity.application)
            FFmpeg.getInstance().init(activity.application)
            ready = true
        }
    }

    @Command
    fun init(invoke: Invoke) {
        Thread {
            try {
                ensureReady()
                val ret = JSObject()
                // 라이브러리에 든 yt-dlp가 오래됐을 수 있어서 최신 안정판으로 업데이트
                try {
                    val st = YoutubeDL.getInstance().updateYoutubeDL(activity.application, YoutubeDL.UpdateChannel.STABLE)
                    ret.put("update", st?.name ?: "UNKNOWN")
                } catch (e: Exception) {
                    ret.put("updateError", e.message ?: e.toString())
                }
                ret.put("version", YoutubeDL.getInstance().version(activity.application) ?: "")
                invoke.resolve(ret)
            } catch (e: Exception) {
                invoke.reject("엔진 준비 실패: ${e.message}")
            }
        }.start()
    }

    @Command
    fun search(invoke: Invoke) {
        val args = invoke.parseArgs(SearchArgs::class.java)
        Thread {
            try {
                ensureReady()
                val req = YoutubeDLRequest("ytsearch${args.count.coerceIn(1, 20)}:${args.query}").common()
                req.addOption("-j")
                req.addOption("--no-warnings")
                req.addOption("--ignore-errors")
                var found = 0
                // 출력 한 줄 = 영상 하나의 JSON → 확인되는 대로 화면에 전달
                val resp = YoutubeDL.getInstance().execute(req, null) { _, _, line ->
                    if (line.startsWith("{")) {
                        found++
                        val ev = JSObject()
                        ev.put("type", "json")
                        ev.put("line", line)
                        args.onEvent.send(ev)
                    }
                }
                // 콜백으로 못 받은 줄이 있으면 최종 출력에서 보충
                if (found == 0) {
                    resp.out.lineSequence().filter { it.startsWith("{") }.forEach {
                        val ev = JSObject()
                        ev.put("type", "json")
                        ev.put("line", it)
                        args.onEvent.send(ev)
                        found++
                    }
                }
                invoke.resolve(obj("count" to found))
            } catch (e: Exception) {
                invoke.reject(e.message ?: e.toString())
            }
        }.start()
    }

    @Command
    fun download(invoke: Invoke) {
        val args = invoke.parseArgs(DownloadArgs::class.java)
        Thread {
            try {
                ensureReady()
                File(args.folder).mkdirs()
                val req = YoutubeDLRequest(args.url).common()
                req.addOption("-f", "bv*[height>=2160]+ba/bv*+ba/b")
                req.addOption("-S", "res,fps")
                req.addOption("--merge-output-format", if (args.container == "mkv") "mkv" else "mp4")
                req.addOption("--retries", "10")
                req.addOption("--fragment-retries", "10")
                req.addOption("--newline")
                req.addOption("-o", "${args.folder}/%(title)s [%(id)s].%(ext)s")
                req.addOption("--print", "after_move:FILE|%(filepath)s")
                req.addOption("--no-quiet")

                var stream = 0
                var stage = "준비 중"
                var filePath: String? = null
                val resp = YoutubeDL.getInstance().execute(req, args.id) { progress, eta, line ->
                    when {
                        line.startsWith("FILE|") -> filePath = line.removePrefix("FILE|")
                        line.startsWith("[download] Destination:") -> {
                            stream++
                            stage = if (stream == 1) "4K 영상 받는 중" else "소리 받는 중"
                        }
                        line.startsWith("[Merger]") -> stage = "영상·소리 병합 중 (ffmpeg)"
                    }
                    val ev = JSObject()
                    ev.put("type", "progress")
                    ev.put("percent", progress.toDouble().coerceAtLeast(0.0))
                    ev.put("eta", if (eta > 0) "${eta / 60}:${"%02d".format(eta % 60)}" else "")
                    ev.put("speed", Regex("""at\s+(\S+/s)""").find(line)?.groupValues?.get(1) ?: "")
                    ev.put("stage", stage)
                    args.onEvent.send(ev)
                }
                val path = filePath ?: resp.out.lineSequence().firstOrNull { it.startsWith("FILE|") }?.removePrefix("FILE|")
                if (path != null) {
                    // 갤러리·파일 앱에 바로 보이게 미디어 스캔
                    MediaScannerConnection.scanFile(activity, arrayOf(path), null, null)
                }
                invoke.resolve(obj("path" to (path ?: "")))
            } catch (e: YoutubeDL.CanceledException) {
                invoke.reject("취소됨")
            } catch (e: Exception) {
                // yt-dlp 오류 중 ERROR: 줄만 골라서 전달
                val msg = (e.message ?: e.toString()).lines().lastOrNull { it.contains("ERROR:") }
                    ?.substringAfter("ERROR:")?.trim() ?: (e.message ?: e.toString()).take(300)
                invoke.reject(msg)
            }
        }.start()
    }

    @Command
    fun cancel(invoke: Invoke) {
        val args = invoke.parseArgs(IdArgs::class.java)
        val ok = YoutubeDL.getInstance().destroyProcessById(args.id)
        invoke.resolve(obj("ok" to ok))
    }

    @Command
    fun listFiles(invoke: Invoke) {
        val args = invoke.parseArgs(FolderArgs::class.java)
        val names = JSArray()
        File(args.folder).listFiles()?.forEach { names.put(it.name) }
        invoke.resolve(obj("files" to names))
    }

    /**
     * 내려받은 APK로 패키지 설치 화면을 띄운다.
     * APK 파일은 다른 앱(패키지 설치 관리자)이 읽어야 하므로 file:// 대신 content:// 주소로 건네고,
     * 그 주소를 읽을 권한을 함께 준다(FLAG_GRANT_READ_URI_PERMISSION).
     */
    @Command
    fun installApk(invoke: Invoke) {
        val args = invoke.parseArgs(PathArgs::class.java)
        try {
            val file = File(args.path)
            if (!file.exists()) {
                invoke.reject("내려받은 설치 파일을 찾지 못했어요.")
                return
            }
            // '출처를 알 수 없는 앱 설치'가 꺼져 있으면 설치 화면이 그냥 닫힌다 → 먼저 알려 준다.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !activity.packageManager.canRequestPackageInstalls()
            ) {
                openUnknownSources()
                invoke.reject("이 앱의 '출처를 알 수 없는 앱 설치'를 허용한 뒤 다시 눌러 주세요.")
                return
            }
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
            invoke.resolve(obj())
        } catch (e: Exception) {
            invoke.reject("설치를 시작하지 못했어요: ${e.message}")
        }
    }

    /** '출처를 알 수 없는 앱 설치' 허용 화면을 연다. 설치가 막혔을 때 안내한다. */
    @Command
    fun openInstallSettings(invoke: Invoke) {
        try {
            openUnknownSources()
            invoke.resolve(obj())
        } catch (e: Exception) {
            invoke.reject("설정 화면을 열 수 없어요: ${e.message}")
        }
    }

    private fun openUnknownSources() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
    }

    @Command
    fun openFile(invoke: Invoke) {
        val args = invoke.parseArgs(PathArgs::class.java)
        try {
            val file = File(args.path)
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(file.extension) ?: "video/*"
            val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
            invoke.resolve(obj())
        } catch (e: Exception) {
            invoke.reject("파일을 열 수 없습니다: ${e.message}")
        }
    }
}

/** JSObject 한 줄로 만들기 */
private fun obj(vararg pairs: Pair<String, Any?>): JSObject {
    val o = JSObject()
    pairs.forEach { (k, v) -> o.put(k, v) }
    return o
}
