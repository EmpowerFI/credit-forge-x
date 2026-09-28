import { BadgeCheck, FlaskConical, Handshake, Library } from "lucide-react";
import { Link } from "react-router-dom";
import { tr } from "../../i18n";
import { EVIDENCE, type EvidenceLabel } from "../../lib/evidence";
import StatusPill from "./StatusPill";

// The addendum's four words, as a mark a screen can wear (v3 §9).
//
// One per screen, not one per tile. In this prototype nearly every figure is a
// simulated assumption, and a word repeated on two hundred tiles teaches a
// reader nothing — the information is in which numbers are not assumptions. So
// a page states what kind of numbers it holds, a panel says so only where it
// differs from its page, and the exceptions are what stand out.

const ICON: Record<EvidenceLabel, typeof BadgeCheck> = {
  observed_pilot_data: BadgeCheck,
  partner_provided: Handshake,
  simulated_assumption: FlaskConical,
  external_benchmark: Library,
};

/** What kind of claim these numbers make. */
export default function EvidenceTag({ label, withIcon = true }: { label: EvidenceLabel; withIcon?: boolean }) {
  const { label: text, means, tone } = EVIDENCE[label];
  const Icon = ICON[label];
  return (
    <StatusPill tone={tone} dot={false}>
      <span className="inline-flex items-center gap-1" title={means}>
        {withIcon && <Icon size={11} aria-hidden />}
        {text}
      </span>
    </StatusPill>
  );
}

/** The four words, explained once, with a way through to the full statement. */
export function EvidenceLegend({ linked = true }: { linked?: boolean }) {
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {(Object.keys(EVIDENCE) as EvidenceLabel[]).map((k) => (
          <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <EvidenceTag label={k} />
            <span className="min-w-0">{EVIDENCE[k].means}</span>
          </li>
        ))}
      </ul>
      {linked && (
        <Link
          to="/app/evidence"
          className="inline-block rounded text-xs font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {tr({ en: "What every number here is made of", pt: "De que é feito cada número daqui" })}
        </Link>
      )}
    </div>
  );
}
