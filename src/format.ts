export function formatDuration(sec: number | null) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h ? `${h}:` : ""}${h ? String(m).padStart(2, "0") : m}:${String(s).padStart(2, "0")}`;
}

export function formatSize(bytes: number | null) {
  if (!bytes) return "크기 미상";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)}GB` : `${Math.round(mb)}MB`;
}

export function heightLabel(h: number) {
  if (h >= 4320) return "8K";
  return "4K";
}

export function formatViews(n: number | null) {
  if (n == null) return "";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억회`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만회`;
  return `${n.toLocaleString()}회`;
}

export function formatDate(d: string | null) {
  if (!d || d.length !== 8) return "";
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}
