import { Check } from "lucide-react";

export default function Checkbox({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition ${
        on ? "border-accent bg-accent" : "border-muted/50"
      }`}
    >
      {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
    </span>
  );
}
