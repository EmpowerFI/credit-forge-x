import type { ReactNode } from "react";

export type Tone = "positive" | "alert" | "caution" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  positive: "tone-positive",
  alert: "tone-alert",
  caution: "tone-caution",
  info: "tone-info",
  neutral: "tone-neutral",
};

/** A state in words, coloured by what it means — never colour alone. */
export default function StatusPill({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
