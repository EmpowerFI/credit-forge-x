import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// The engine's third act reads best of anything in this product, and the reason
// is not the drawing: it is that each stage passes through *reading* before it
// settles, so the page behaves like something being counted rather than
// something already known. A row of finished boxes says "these are the legs".
// The same row arriving one leg at a time says "this is a journey", which is
// the claim.
//
// That act is driven by a clock the reader starts. The money routes have no
// button and no user to press it — they are the record, not a run — so the
// same mechanism runs once, when the rail is first scrolled into view.
//
// A reader who asked for reduced motion gets the finished rail immediately.
// Nothing here is load-bearing: every figure is in the DOM from the first
// paint, and the states only change how it looks.

export type RailState = "waiting" | "running" | "settled";

/**
 * Settles `count` steps in order, once, when the returned ref's element comes
 * into view. Attach the ref to the list; ask `state(i)` for each row.
 */
export function useRailReveal(count: number, opts: { stepMs?: number; startMs?: number } = {}) {
  const { stepMs = 520, startMs = 160 } = opts;
  // How many have settled. `running` is the one after them, while there is one.
  const [settled, setSettled] = useState(0);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLOListElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current || count === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSettled(count);
      setDone(true);
      return;
    }
    const timers: number[] = [];
    const io = new IntersectionObserver((entries) => {
      if (started.current || !entries.some((e) => e.isIntersecting)) return;
      started.current = true;
      io.disconnect();
      for (let i = 1; i <= count; i += 1) {
        timers.push(window.setTimeout(() => {
          setSettled(i);
          if (i === count) setDone(true);
        }, startMs + i * stepMs));
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => {
      io.disconnect();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [count, stepMs, startMs]);

  return {
    ref,
    done,
    state: (i: number): RailState => (i < settled ? "settled" : i === settled && !done ? "running" : "waiting"),
  };
}

/** How a step's own card reads in each state, for a rail that wants the engine's look. */
export const railCard = (state: RailState) => cn(
  "min-w-0 flex-1 transition-all duration-300 motion-reduce:transition-none",
  state === "waiting" ? "opacity-40 motion-reduce:opacity-100"
    : state === "running" ? "opacity-100" : "opacity-100");
