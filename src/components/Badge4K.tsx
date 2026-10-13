import { heightLabel } from "../format";

/** 초록 테두리 4K / Ultra HD 배지 */
export default function Badge4K({ height }: { height: number }) {
  return (
    <div className="flex shrink-0 flex-col items-center rounded-md border-2 border-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 leading-none text-emerald-300">
      <span className="text-base font-black tracking-tight">{heightLabel(height)}</span>
      <span className="text-[8px] font-semibold uppercase">Ultra HD</span>
    </div>
  );
}
