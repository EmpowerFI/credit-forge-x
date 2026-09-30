import { Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RailState } from "../../lib/moneyRail";

/**
 * The spine and the marker that travels down it, as the engine draws them: a
 * hairline that turns accent behind what has settled, and a disc that holds a
 * spinner while a step is being read and a filled dot once it has arrived.
 *
 * `first` and `last` trim the spine so it does not overshoot the rail's ends.
 */
export function RailMarker({ state, first, last, children }: {
  state: RailState;
  first?: boolean;
  last?: boolean;
  /** Put a number here to keep a numbered route numbered. */
  children?: React.ReactNode;
}) {
  const settled = state === "settled";
  return (
    <span aria-hidden className="relative flex w-5 shrink-0 justify-center">
      <span className={cn("absolute w-0.5 transition-colors duration-300 motion-reduce:transition-none",
        first ? "top-3 bottom-0" : last ? "top-0 bottom-3" : "inset-y-0",
        settled ? "bg-accent/40" : "bg-border")} />
      <span className={cn("relative mt-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-card text-[10px] transition-colors duration-300 motion-reduce:transition-none",
        state === "running" ? "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.15)]"
          : settled ? "border-accent/60 text-muted-foreground" : "border-border text-muted-foreground/60")}>
        {state === "running"
          ? <Loader2 size={12} className="animate-spin text-accent motion-reduce:animate-none" />
          : children ?? <Circle size={8} className={settled ? "fill-accent text-accent" : "text-muted-foreground/50"} />}
      </span>
    </span>
  );
}
