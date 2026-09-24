import { ArrowDown, ArrowRight, RotateCcw } from "lucide-react";

export interface FlowStep {
  label: string;
  /** Second line, e.g. the rail a participant actually touches ("Pix / local currency"). */
  sub?: string;
  /** Nodes worth stopping on: the capital at either end, and the EmpowerFI layer. */
  emphasis?: boolean;
}

interface CapitalFlowProps {
  steps: FlowStep[];
  /**
   * Closes the chain back onto its first node — used by the flows that are
   * cycles rather than pipelines (capital out, capital repaid).
   */
  loopLabel?: string;
  /** Accessible description of what the chain shows, for screen readers. */
  caption: string;
}

/**
 * The conceptual capital chains the thesis rests on — global capital reaching a
 * microbusiness, and the repayment coming back. Vertical on phones, horizontal
 * and wrapping from md up, so an eight-node chain stays readable at any width.
 *
 * Each item pairs its *incoming* arrow with its node so the two wrap together:
 * a row can then never end on an arrow pointing at nothing.
 */
const CapitalFlow = ({ steps, loopLabel, caption }: CapitalFlowProps) => (
  <figure className="space-y-4">
    <ol className="flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
      {/* Keyed by position: a cycle legitimately repeats a label (USDC out,
          USDC back), and these lists are static. */}
      {steps.map(({ label, sub, emphasis }, i) => (
        <li
          key={`${i}-${label}`}
          className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-3"
        >
          {i > 0 && (
            <span aria-hidden className="flex items-center justify-center text-accent">
              <ArrowDown size={18} className="md:hidden" />
              <ArrowRight size={18} className="hidden md:block" />
            </span>
          )}

          {/* The node the chain is for — her business — is the one that is
              filled; every other node is an outline, so the eye lands on the
              end of the chain rather than on the middle of it. */}
          <div
            className={[
              "flex min-h-[3.25rem] flex-col justify-center rounded-sm px-4 py-2.5 text-center md:px-5",
              emphasis ? "border-[1.5px] border-gold bg-gold/14" : "border border-foreground/25",
            ].join(" ")}
          >
            <span className="block font-heading text-[1.0625rem] leading-tight text-foreground">
              {label}
            </span>
            {sub && (
              <span className="mt-0.5 block text-sm text-foreground/65">{sub}</span>
            )}
          </div>
        </li>
      ))}
    </ol>

    {loopLabel && (
      <p className="flex items-center justify-center gap-2 text-xs font-medium text-accent">
        <RotateCcw size={13} aria-hidden /> {loopLabel}
      </p>
    )}

    <figcaption className="sr-only">{caption}</figcaption>
  </figure>
);

export default CapitalFlow;
