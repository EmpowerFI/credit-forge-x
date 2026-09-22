import type { ReactNode } from "react";
import type { Tone } from "./StatusPill";

const HINT_TONE: Record<Tone, string> = {
  positive: "text-positive", alert: "text-alert", caution: "text-caution", info: "text-info", neutral: "text-muted-foreground",
};

/** One number that matters, with what it is and, optionally, what it means. */
export default function StatTile({ label, value, hint, hintTone = "neutral", icon }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  hintTone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="panel flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        {/* Two lines rather than one: a label cut off mid-word ("Credit, per
            R$ 100 lent…") hides the very thing that says what the number is. */}
        <p className="line-clamp-2 text-xs font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="num font-heading text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className={`num text-xs ${HINT_TONE[hintTone]}`}>{hint}</p>}
      </div>
    </div>
  );
}
