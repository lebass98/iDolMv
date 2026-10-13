import { ChevronDown } from "lucide-react";
import { GENRES, type Genre } from "../types";

interface Props {
  value: Set<Genre>;
  counts: (g: Genre) => number;
  onChange: (v: Set<Genre>) => void;
}

/** "전체 ▾" 장르 드롭다운 (한 개 선택) */
export default function GenreSelect({ value, counts, onChange }: Props) {
  const current = value.size === 1 ? [...value][0] : "";
  return (
    <div className="relative shrink-0">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value ? new Set([e.target.value as Genre]) : new Set())}
        className="field h-10 appearance-none pl-3.5 pr-8 text-sm font-semibold text-fg outline-none"
      >
        <option value="">전체</option>
        {GENRES.map((g) => {
          const n = counts(g);
          return n > 0 ? (
            <option key={g} value={g}>
              {g} ({n})
            </option>
          ) : null;
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
