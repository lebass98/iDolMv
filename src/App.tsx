import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Download, FolderOpen, History, ListMusic, Moon, Play, Search, Settings, Sun } from "lucide-react";
import { cancelDownload, fetchPlaylist, initEngine, isAndroid, isMac, probe4k, revealFile, search4k, startDownload } from "./backend";
import HistoryView, { type HistoryItem } from "./components/HistoryView";
import SettingsView from "./components/SettingsView";
import UpdateModal from "./components/UpdateModal";
import { useAppUpdate } from "./hooks/useAppUpdate";
import ChartPanel, { visibleArtists, type ArtistSort } from "./components/ChartPanel";
import SongPanel, { songKey, visibleSongs, type SongSort } from "./components/SongPanel";
import PlaylistPanel, { visibleItems } from "./components/PlaylistPanel";
import ResultsPanel, { sortResults, type MvSort } from "./components/ResultsPanel";
import QueuePanel from "./components/QueuePanel";
import type {
  Chart,
  DoneEvent,
  ErrorEvent,
  FoundMv,
  Genre,
  Job,
  ProgressEvent,
  SearchResultEvent,
  MvResult,
  PlaylistInfo,
  SongChart,
} from "./types";

const FOLDER_KEY = "idolFolder";
const CONTAINER_KEY = "idolContainer";
const THEME_KEY = "idolTheme";
const HISTORY_KEY = "idolHistory";
const COUNT_KEY = "idolSearchCounts";
const MAX_AUTO_RETRY = 2; // 403 오류 자동 재시도 횟수

type Tab = "song" | "artist" | "playlist";

/**
 * 4K 검색에 넣을 대상.
 *   query 차트 탭 — 검색어로 유튜브에서 찾는다
 *   url   플레이리스트 탭 — 주소를 받았으니 그 영상만 확인한다
 */
type SearchTarget =
  | { kind: "query"; label: string; query: string; count: number }
  | { kind: "url"; label: string; url: string };
type View = "download" | "history" | "settings";
type Theme = "dark" | "light";

/** 화면 폭 판별용 */
function useMedia(q: string) {
  const [phone, setPhone] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

/** 휴대폰: 820px 이하 / 중간(폴드 펼침·작은 태블릿): 821~1279px / 넓은 화면: 1280px 이상 */
const useIsPhone = () => useMedia("(max-width: 820px)");
const useIsMedium = () => useMedia("(min-width: 821px) and (max-width: 1279px)");

type PhoneView = "chart" | "results" | "queue" | "history" | "settings";

export default function App() {
  const isPhone = useIsPhone();
  const isMedium = useIsMedium();
  // 중간 화면: 오른쪽 영역에서 검색 결과 / 다운로드 현황 전환
  const [rightPane, setRightPane] = useState<"results" | "queue">("results");
  const [phoneView, setPhoneView] = useState<PhoneView>("chart");
  // 테마 (다크 / 화이트)
  const [theme, setTheme] = useState<Theme>((localStorage.getItem(THEME_KEY) as Theme) ?? "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const [tab, setTab] = useState<Tab>("song");
  const [view, setView] = useState<View>("download");

  // 새 버전 확인·설치 (앱을 켤 때와 창으로 돌아올 때 자동, 설정에서 직접도 가능)
  const update = useAppUpdate();

  // 검색 개수 (설정): 가수당 / 곡당
  const [counts, setCounts] = useState<{ artist: number; song: number }>(() => {
    try {
      return JSON.parse(localStorage.getItem(COUNT_KEY) ?? "") ;
    } catch {
      return { artist: 6, song: 3 };
    }
  });
  useEffect(() => localStorage.setItem(COUNT_KEY, JSON.stringify(counts)), [counts]);

  // 다운로드 기록 (히스토리)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 500))), [history]);

  // 써클차트 (곡)
  const [songChart, setSongChart] = useState<SongChart | null>(null);
  const [songLoading, setSongLoading] = useState(false);
  const [songError, setSongError] = useState("");
  const [term, setTerm] = useState("week");
  const [songGenres, setSongGenres] = useState<Set<Genre>>(new Set());
  const [songSort, setSongSort] = useState<SongSort>("rank");
  const [songQuery, setSongQuery] = useState("");
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());

  // 차트
  const [chart, setChart] = useState<Chart | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [period, setPeriod] = useState("");
  const [genres, setGenres] = useState<Set<Genre>>(new Set());
  const [artistSort, setArtistSort] = useState<ArtistSort>("rank");
  const [rankedOnly, setRankedOnly] = useState(false);
  const [mvSort, setMvSort] = useState<MvSort>("relevance");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 플레이리스트 (주소로 불러온 목록)
  const [plUrl, setPlUrl] = useState("");
  const [plInfo, setPlInfo] = useState<PlaylistInfo | null>(null);
  const [plLoading, setPlLoading] = useState(false);
  const [plError, setPlError] = useState("");
  const [plQuery, setPlQuery] = useState("");
  const [plSelected, setPlSelected] = useState<Set<string>>(new Set());

  // 검색
  const [results, setResults] = useState<FoundMv[]>([]);
  const [searching, setSearching] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  // 다운로드
  const [folder, setFolder] = useState(localStorage.getItem(FOLDER_KEY) ?? "");
  const [container, setContainer] = useState(localStorage.getItem(CONTAINER_KEY) ?? "mp4");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const startingRef = useRef(false);

  const addLog = useCallback((line: string) => setLogs((l) => [...l.slice(-300), line]), []);

  const loadChart = useCallback(async (p: string) => {
    setChartLoading(true);
    setChartError("");
    try {
      const c = await invoke<Chart>("fetch_chart", { period: p });
      setChart(c);
      addLog(`📊 차트 갱신: 순위 ${c.rankedCount}명 + 내장 사전 ${c.entries.length - c.rankedCount}명`);
    } catch (e) {
      setChartError(String(e));
      addLog(`⚠️ ${e}`);
    } finally {
      setChartLoading(false);
    }
  }, [addLog]);

  const loadSongs = useCallback(async (t: string) => {
    setSongLoading(true);
    setSongError("");
    try {
      setSongChart(await invoke<SongChart>("fetch_circle", { term: t }));
    } catch (e) {
      setSongError(String(e));
      addLog(`⚠️ ${e}`);
    } finally {
      setSongLoading(false);
    }
  }, [addLog]);

  const loadPlaylist = useCallback(async () => {
    const url = plUrl.trim();
    if (!url) return;
    setPlLoading(true);
    setPlError("");
    try {
      const info = await fetchPlaylist(url);
      setPlInfo(info);
      // 목록이 바뀌면 전에 고른 것은 지운다 (id가 겹칠 수 있어 섞이면 헷갈린다)
      setPlSelected(new Set());
      setPlQuery("");
      addLog(`🎵 플레이리스트 "${info.title}": ${info.items.length}개`);
    } catch (e) {
      setPlInfo(null);
      setPlError(String(e));
      addLog(`⚠️ 플레이리스트: ${e}`);
    } finally {
      setPlLoading(false);
    }
  }, [plUrl, addLog]);

  useEffect(() => {
    loadSongs("week");
    loadChart("");
    if (!folder) invoke<string>("default_download_dir").then(setFolder);
    // 안드로이드: 다운로드 엔진 준비 (처음 실행 때 시간이 걸림)
    if (isAndroid) {
      addLog("⚙️ 다운로드 엔진 준비 중…");
      initEngine()
        .then((v) => v && addLog(`⚙️ 엔진 준비 완료: ${v}`))
        .catch((e) => addLog(`⚠️ 엔진 준비 실패: ${e}`));
    }
  }, []);

  // 다운로드 진행·완료·실패 처리 (맥은 이벤트, 안드로이드는 채널에서 호출)
  const updateJob = useCallback(
    (id: string, patch: Partial<Job>) => setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j))),
    [],
  );
  const failJob = useCallback(
    (id: string, message: string) =>
      setJobs((list) =>
        list.map((j) => {
          if (j.id !== id) return j;
          // 403(유튜브가 임시 주소를 막음)은 새 주소로 자동 재시도
          const retries = j.retries ?? 0;
          if (/403|Forbidden/i.test(message) && retries < MAX_AUTO_RETRY) {
            addLog(`🔁 403 오류 — 자동 재시도 ${retries + 1}/${MAX_AUTO_RETRY}: ${j.mv.title}`);
            return { ...j, state: "queued", percent: 0, speed: "", eta: "", stage: "재시도 대기", retries: retries + 1 };
          }
          addLog(`❌ 실패: ${j.mv.title} — ${message}`);
          return { ...j, state: "error", error: message };
        }),
      ),
    [addLog],
  );
  const addResult = useCallback(
    (artist: string, video: MvResult) =>
      setResults((r) => (r.some((x) => x.id === video.id) ? r : [...r, { ...video, artist }])),
    [],
  );

  // 백엔드 이벤트 구독
  useEffect(() => {
    const unlisten = Promise.all([
      listen<string>("log://line", ({ payload }) => addLog(payload)),
      listen<SearchResultEvent>("search://result", ({ payload: { artist, video } }) => addResult(artist, video)),
      listen<ProgressEvent>("download://progress", ({ payload: p }) =>
        updateJob(p.id, { percent: p.percent, speed: p.speed, eta: p.eta, stage: p.stage }),
      ),
      listen<DoneEvent>("download://done", ({ payload: p }) =>
        updateJob(p.id, { state: "done", percent: 100, path: p.path }),
      ),
      listen<ErrorEvent>("download://error", ({ payload: p }) => failJob(p.id, p.message)),
    ]);
    return () => {
      unlisten.then((fns) => fns.forEach((f) => f()));
    };
  }, [addLog, addResult, updateJob, failJob]);

  // 큐: 진행 중인 게 없으면 다음 대기 항목을 시작 (순차 다운로드)
  useEffect(() => {
    if (startingRef.current || jobs.some((j) => j.state === "running")) return;
    const next = jobs.find((j) => j.state === "queued");
    if (!next) return;
    startingRef.current = true;
    setJobs((list) => list.map((j) => (j.id === next.id ? { ...j, state: "running", stage: "준비 중" } : j)));
    addLog(`⬇️ 다운로드 시작: ${next.mv.title}`);
    startDownload(
      { id: next.id, url: next.mv.url, title: next.mv.title, folder, container },
      {
        onProgress: (p) => updateJob(next.id, p),
        onDone: (path) => {
          addLog(`✅ 완료: ${path}`);
          updateJob(next.id, { state: "done", percent: 100, path });
        },
        onError: (m) => failJob(next.id, m),
      },
    )
      .catch((e) =>
        setJobs((list) => list.map((j) => (j.id === next.id ? { ...j, state: "error", error: String(e) } : j))),
      )
      .finally(() => {
        startingRef.current = false;
      });
  }, [jobs, folder, container]);

  // 저장 폴더에 이미 있는 영상 확인 (검색 결과·폴더가 바뀔 때)
  useEffect(() => {
    if (!folder || results.length === 0) return;
    invoke<string[]>("downloaded_ids", {
      folder,
      items: results.map((r) => ({ id: r.id, title: r.title })),
    }).then((ids) => setDownloaded(new Set(ids)));
  }, [results, folder]);

  // 이번에 다운로드 완료된 영상도 바로 표시 + 히스토리에 기록
  useEffect(() => {
    const doneJobs = jobs.filter((j) => j.state === "done");
    const done = doneJobs.map((j) => j.mv.id);
    if (done.some((id) => !downloaded.has(id))) setDownloaded((s) => new Set([...s, ...done]));
    const fresh = doneJobs.filter((j) => j.path && !history.some((h) => h.jobId === j.id));
    if (fresh.length)
      setHistory((h) => [
        ...fresh.map((j) => ({
          jobId: j.id,
          title: j.mv.title,
          artist: j.mv.artist,
          thumbnail: j.mv.thumbnail,
          path: j.path!,
          height: j.mv.maxHeight,
          at: new Date().toISOString(),
        })),
        ...h,
      ]);
  }, [jobs]);

  const selectedEntries = useMemo(
    () => visibleArtists(chart?.entries ?? [], new Set(), false, "", artistSort).filter((e) => selected.has(e.name)),
    [chart, selected, artistSort],
  );

  function toggleIdol(name: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  }

  const selectedSongEntries = useMemo(
    () => visibleSongs(songChart?.entries ?? [], new Set(), "", songSort).filter((e) => selectedSongs.has(songKey(e))),
    [songChart, selectedSongs, songSort],
  );

  const selectedPlaylistItems = useMemo(
    () => (plInfo?.items ?? []).filter((e) => plSelected.has(e.id)),
    [plInfo, plSelected],
  );

  // 검색 대상
  //   곡 탭          → "가수 곡명 MV 4K" 로 찾기
  //   가수 탭        → "가수 MV 4K" 로 찾기
  //   플레이리스트 탭 → 고른 영상의 주소를 그대로 확인 (찾을 필요가 없다)
  const targets: SearchTarget[] =
    tab === "song"
      ? selectedSongEntries.map((e) => ({
          kind: "query" as const,
          label: `${e.artist} - ${e.song}`,
          query: `${e.searchArtist} ${e.song} MV 4K`,
          count: counts.song,
        }))
      : tab === "artist"
        ? selectedEntries.map((e) => ({
            kind: "query" as const,
            label: e.name,
            query: `${e.searchName} MV 4K`,
            count: counts.artist,
          }))
        : selectedPlaylistItems.map((e) => ({ kind: "url" as const, label: e.title, url: e.url }));

  async function searchSelected() {
    setResults([]);
    setPicked(new Set());
    for (const t of targets) {
      setSearching(t.label);
      try {
        const n =
          t.kind === "url"
            ? await probe4k(t.label, t.url, addResult)
            : await search4k(t.label, t.query, t.count, addResult);
        if (isAndroid) addLog(`   ${t.label}: 4K ${n}개`);
      } catch (err) {
        addLog(`⚠️ ${t.label} 검색 실패: ${err}`);
      }
    }
    setSearching(null);
    addLog("🔎 검색 완료");
  }

  function enqueue(mvs: FoundMv[]) {
    const inQueue = new Set(jobs.filter((j) => j.state === "queued" || j.state === "running").map((j) => j.mv.id));
    const fresh = mvs.filter((m) => !inQueue.has(m.id));
    if (!fresh.length) return;
    setJobs((list) => [
      ...list,
      ...fresh.map<Job>((mv) => ({
        id: crypto.randomUUID(),
        mv,
        state: "queued",
        percent: 0,
        speed: "",
        eta: "",
        stage: "대기 중",
      })),
    ]);
    addLog(`➕ 대기열에 ${fresh.length}개 추가`);
  }

  function cancel(id: string) {
    const job = jobs.find((j) => j.id === id);
    if (job?.state === "running") cancelDownload(id);
    setJobs((list) => list.map((j) => (j.id === id ? { ...j, state: "cancelled" } : j)));
  }

  async function chooseFolder() {
    const picked = await open({ directory: true, defaultPath: folder, title: "MV 저장 폴더 선택" });
    if (typeof picked === "string") {
      setFolder(picked);
      localStorage.setItem(FOLDER_KEY, picked);
    }
  }

  const queuedIds = new Set(jobs.filter((j) => j.state === "queued" || j.state === "running").map((j) => j.mv.id));
  const activeCount = jobs.filter((j) => j.state === "queued" || j.state === "running").length;

  function cancelAll() {
    jobs.filter((j) => j.state === "running").forEach((j) => cancelDownload(j.id));
    setJobs((l) => l.map((j) => (j.state === "queued" || j.state === "running" ? { ...j, state: "cancelled" } : j)));
    addLog("⏹ 전체 취소");
  }

  const NAV = [
    { v: "download" as const, label: "다운로드", icon: Download },
    { v: "folder" as const, label: "저장폴더", icon: FolderOpen },
    { v: "history" as const, label: "히스토리", icon: History },
  ];

  const selectedCount =
    tab === "song"
      ? selectedSongEntries.length
      : tab === "artist"
        ? selectedEntries.length
        : selectedPlaylistItems.length;

  // ───────── 패널들 (넓은 화면·휴대폰 공통) ─────────
  const chartSection = (
    <section className="panel flex w-[330px] shrink-0 flex-col overflow-hidden">
      <div className="field mx-4 mt-4 grid grid-cols-3 gap-1 !rounded-full p-1">
        {(
          [
            { v: "song", label: "써클차트" },
            { v: "artist", label: "아이돌차트" },
            { v: "playlist", label: "플레이리스트" },
          ] as const
        ).map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`whitespace-nowrap rounded-full py-2 text-[13px] font-semibold transition ${
              tab === t.v ? "btn-accent" : "text-fg/80 hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "song" && (
        <SongPanel
          chart={songChart}
          loading={songLoading}
          error={songError}
          term={term}
          genres={songGenres}
          sort={songSort}
          query={songQuery}
          selected={selectedSongs}
          onRefresh={() => loadSongs(term)}
          onTerm={(v) => {
            setTerm(v);
            loadSongs(v);
          }}
          onGenres={setSongGenres}
          onSort={setSongSort}
          onQuery={setSongQuery}
          onToggle={(k) =>
            setSelectedSongs((s) => {
              const n = new Set(s);
              n.has(k) ? n.delete(k) : n.add(k);
              return n;
            })
          }
          onSetMany={(keys, on) =>
            setSelectedSongs((s) => {
              const n = new Set(s);
              keys.forEach((k) => (on ? n.add(k) : n.delete(k)));
              return n;
            })
          }
        />
      )}
      {tab === "artist" && (
        <ChartPanel
          chart={chart}
          loading={chartLoading}
          error={chartError}
          period={period}
          genres={genres}
          sort={artistSort}
          rankedOnly={rankedOnly}
          query={query}
          selected={selected}
          onRefresh={() => loadChart(period)}
          onPeriod={(v) => {
            setPeriod(v);
            loadChart(v);
          }}
          onGenres={setGenres}
          onSort={setArtistSort}
          onRankedOnly={setRankedOnly}
          onQuery={setQuery}
          onToggle={toggleIdol}
          onSetMany={(names, on) =>
            setSelected((s) => {
              const n = new Set(s);
              names.forEach((name) => (on ? n.add(name) : n.delete(name)));
              return n;
            })
          }
        />
      )}
      {tab === "playlist" && (
        <PlaylistPanel
          url={plUrl}
          info={plInfo}
          loading={plLoading}
          error={plError}
          query={plQuery}
          selected={plSelected}
          onUrl={setPlUrl}
          onLoad={loadPlaylist}
          onQuery={setPlQuery}
          onToggle={(id) =>
            setPlSelected((s) => {
              const n = new Set(s);
              n.has(id) ? n.delete(id) : n.add(id);
              return n;
            })
          }
          onSetMany={(ids, on) =>
            setPlSelected((s) => {
              const n = new Set(s);
              ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
              return n;
            })
          }
        />
      )}
      {/* 휴대폰: 선택한 항목 바로 검색 */}
      {isPhone && selectedCount > 0 && (
        <div className="border-t border-line p-3">
          <button
            onClick={() => {
              setPhoneView("results");
              searchSelected();
            }}
            disabled={!!searching}
            className="btn-accent flex w-full items-center justify-center gap-2 py-3 text-[15px] font-semibold"
          >
            <Search className="h-5 w-5" /> 선택한 {selectedCount}개 4K 검색
          </button>
        </div>
      )}
    </section>
  );

  const resultsPanel = (
    <ResultsPanel
      results={sortResults(results, mvSort)}
      sort={mvSort}
      onSort={setMvSort}
      searching={searching}
      selectedNames={targets.map((t) => t.label)}
      emptyHint={
        tab === "playlist"
          ? "플레이리스트에서 받을 곡을 고르세요"
          : tab === "song"
            ? "왼쪽에서 곡을 선택하세요"
            : "왼쪽에서 아이돌을 선택하세요"
      }
      picked={picked}
      queuedIds={queuedIds}
      downloadedIds={downloaded}
      onSearch={searchSelected}
      onPick={(id) =>
        setPicked((s) => {
          const n = new Set(s);
          n.has(id) ? n.delete(id) : n.add(id);
          return n;
        })
      }
      onDownload={(mv) => enqueue([mv])}
      onPickAll={(on) => setPicked(on ? new Set(results.map((r) => r.id)) : new Set())}
      onBatch={() => {
        enqueue(results.filter((r) => picked.has(r.id)));
        setPicked(new Set());
        if (isPhone) setPhoneView("queue");
        if (isMedium) setRightPane("queue");
      }}
    />
  );

  const queuePanel = (
    <QueuePanel
      folder={folder}
      container={container}
      jobs={jobs}
      logs={logs}
      canChangeFolder={!isAndroid}
      onChangeFolder={chooseFolder}
      onContainer={(c) => {
        setContainer(c);
        localStorage.setItem(CONTAINER_KEY, c);
      }}
      onCancel={cancel}
      onCancelAll={cancelAll}
      onRetry={(id) =>
        setJobs((l) =>
          l.map((j) =>
            j.id === id ? { ...j, state: "queued", percent: 0, error: undefined, stage: "대기 중", retries: 0 } : j,
          ),
        )
      }
      onReveal={(path) => revealFile(path)}
      onClearFinished={() => setJobs((l) => l.filter((j) => j.state === "queued" || j.state === "running"))}
      onClearLogs={() => setLogs([])}
    />
  );

  const historyView = (
    <HistoryView
      items={history}
      onReveal={(path) => revealFile(path)}
      onRemove={(jobId) => setHistory((h) => h.filter((x) => x.jobId !== jobId))}
      onClear={() => setHistory([])}
    />
  );

  const settingsView = (
    <SettingsView
      theme={theme}
      container={container}
      folder={folder}
      counts={counts}
      canChangeFolder={!isAndroid}
      onTheme={setTheme}
      onContainer={(c) => {
        setContainer(c);
        localStorage.setItem(CONTAINER_KEY, c);
      }}
      onChangeFolder={chooseFolder}
      onCounts={setCounts}
      update={update}
    />
  );

  const themeToggle = (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={theme === "dark" ? "화이트 모드로" : "다크 모드로"}
      className="field flex h-9 items-center gap-0.5 !rounded-full p-1"
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${theme === "light" ? "bg-accent text-white" : "text-muted"}`}>
        <Sun className="h-4 w-4" />
      </span>
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${theme === "dark" ? "bg-accent text-white" : "text-muted"}`}>
        <Moon className="h-4 w-4" />
      </span>
    </button>
  );

  // ───────── 휴대폰: 위 제목줄 + 한 화면 + 아래 탭 막대 ─────────
  if (isPhone) {
    const TABS: { v: PhoneView; label: string; icon: typeof Download; badge?: number }[] = [
      { v: "chart", label: "차트", icon: ListMusic, badge: selectedCount },
      { v: "results", label: "검색", icon: Search, badge: results.length },
      { v: "queue", label: "다운로드", icon: Download, badge: activeCount },
      { v: "history", label: "히스토리", icon: History },
      { v: "settings", label: "설정", icon: Settings },
    ];
    return (
      <div className={`app-bg flex h-screen flex-col ${isAndroid ? "pt-[max(env(safe-area-inset-top),28px)]" : ""}`}>
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent shadow-md shadow-accent/30">
            <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
          </div>
          <span className="truncate text-[17px] font-bold">Idol MV 4K</span>
          <div className="ml-auto">{themeToggle}</div>
        </div>

        {/* 고정 폭(w-[330px] 등)을 휴대폰에서는 꽉 채움 */}
        <div className="flex min-h-0 flex-1 px-2 pb-2 *:!w-full *:!flex-1 *:!rounded-2xl">
          {phoneView === "chart" && chartSection}
          {phoneView === "results" && resultsPanel}
          {phoneView === "queue" && queuePanel}
          {phoneView === "history" && historyView}
          {phoneView === "settings" && settingsView}
        </div>

        <nav className="panel mx-2 mb-2 grid shrink-0 grid-cols-5 !rounded-2xl p-1 pb-[max(4px,env(safe-area-inset-bottom))]">
          {TABS.map((t) => {
            const on = phoneView === t.v;
            return (
              <button
                key={t.v}
                onClick={() => setPhoneView(t.v)}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold ${
                  on ? "text-accent" : "text-muted"
                }`}
              >
                <t.icon className="h-[22px] w-[22px]" />
                {t.label}
                {!!t.badge && (
                  <span className="absolute right-[18%] top-0.5 min-w-4 rounded-full bg-accent px-1 text-[10px] leading-4 text-white">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <UpdateModal u={update} />
      </div>
    );
  }

  // ───────── 넓은 화면(맥·태블릿): 메뉴 + 3단 ─────────
  return (
    <div className={`app-bg flex h-screen flex-col ${isAndroid ? "pt-[max(env(safe-area-inset-top),28px)]" : ""}`}>
      {/* 타이틀바 (창 이동) */}
      <div data-tauri-drag-region className={`flex h-14 shrink-0 items-center gap-3 pr-4 ${isMac ? "pl-[88px]" : "pl-4"}`}>
        <div data-tauri-drag-region className="flex h-8 w-8 items-center justify-center rounded-full bg-accent shadow-md shadow-accent/30">
          <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
        </div>
        <span data-tauri-drag-region className="text-[17px] font-bold">
          Idol MV 4K Downloader
        </span>
        <button
          onClick={() => setView("settings")}
          title="설정"
          className="btn-ghost ml-auto flex h-9 w-9 items-center justify-center"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
        {themeToggle}
      </div>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        {/* 왼쪽 메뉴 */}
        <nav className={`panel flex shrink-0 flex-col gap-1.5 p-2.5 ${isMedium ? "w-[64px] items-center" : "w-[136px]"}`}>
          {NAV.filter((n) => !(isAndroid && n.v === "folder")).map((n) => {
            const on = n.v === view;
            return (
              <button
                key={n.v}
                onClick={() => (n.v === "folder" ? invoke("open_folder", { path: folder }) : setView(n.v))}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-[15px] font-semibold transition ${
                  on ? "btn-accent !rounded-xl" : "text-fg/80 hover:bg-surface"
                }`}
              >
                <n.icon className="h-5 w-5 shrink-0" />
                {!isMedium && n.label}
                {!isMedium && n.v === "download" && activeCount > 0 && !on && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] text-white">{activeCount}</span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setView("settings")}
            className={`mt-auto flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-[15px] font-semibold transition ${
              view === "settings" ? "btn-accent !rounded-xl" : "text-fg/80 hover:bg-surface"
            }`}
          >
            <Settings className="h-5 w-5 shrink-0" /> {!isMedium && "설정"}
          </button>
        </nav>

        {view === "history" && historyView}
        {view === "settings" && settingsView}
        {view === "download" && !isMedium && (
          <>
            {chartSection}
            {resultsPanel}
            {queuePanel}
          </>
        )}

        {/* 중간 화면: 차트 + (검색 결과 | 다운로드 현황) 전환 */}
        {view === "download" && isMedium && (
          <>
            {chartSection}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="field grid shrink-0 grid-cols-2 gap-1 !rounded-full p-1">
                {(
                  [
                    { v: "results", label: `검색 결과 (${results.length})`, icon: Search },
                    { v: "queue", label: `다운로드 현황${activeCount ? ` (${activeCount})` : ""}`, icon: Download },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.v}
                    onClick={() => setRightPane(t.v)}
                    className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${
                      rightPane === t.v ? "btn-accent" : "text-fg/80 hover:text-fg"
                    }`}
                  >
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-1 *:!w-full *:!flex-1">
                {rightPane === "results" ? resultsPanel : queuePanel}
              </div>
            </div>
          </>
        )}
      </div>

      <UpdateModal u={update} />
    </div>
  );
}
