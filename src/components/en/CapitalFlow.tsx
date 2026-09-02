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
  /**
   * Stay stacked at every breakpoint. For a short chain in a narrow column —
   * the hero's side panel — rather than a full-width section.
   */
  vertical?: boolean;
}

/**
 * The conceptual capital chains the thesis rests on — global capital reaching a
 * microbusiness, and the repayment coming back. Vertical on phones, horizontal
 * and wrapping from md up, so an eight-node chain stays readable at any width.
 *
 * Each item pairs its *incoming* arrow with its node so the two wrap together:
 * a row can then never end on an arrow pointing at nothing.
 */
const CapitalFlow = ({ steps, loopLabel, caption, vertical = false }: CapitalFlowProps) => (
  <figure className={vertical ? "space-y-3" : "space-y-4"}>
    <ol
      className={
        vertical
          ? "flex flex-col items-stretch gap-2"
          : "flex flex-col items-stretch justify-center gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3"
      }
    >
      {/* Keyed by position: a cycle legitimately repeats a label (USDC out,
          USDC back), and these lists are static. */}
      {steps.map(({ label, sub, emphasis }, i) => (
        <li
          key={`${i}-${label}`}
          className={
            vertical
              ? "flex flex-col items-stretch gap-2"
              : "flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-3"
          }
        >
          {i > 0 && (
            <span aria-hidden className="flex items-center justify-center text-accent">
              <ArrowDown size={18} className={vertical ? "" : "md:hidden"} />
              {!vertical && <ArrowRight size={18} className="hidden md:block" />}
            </span>
          )}

          <div
            className={[
              "rounded-xl px-4 py-3 text-center md:px-5",
              emphasis ? "gradient-primary shadow-glow" : "glass glow-border",
            ].join(" ")}
          >
            <span
              className={[
                "block font-heading text-sm font-semibold tracking-tight",
                emphasis ? "text-primary-foreground" : "text-foreground",
              ].join(" ")}
            >
              {label}
            </span>
            {sub && (
              <span
                className={[
                  "mt-0.5 block text-xs",
                  emphasis ? "text-primary-foreground/80" : "text-muted-foreground",
                ].join(" ")}
              >
                {sub}
              </span>
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
