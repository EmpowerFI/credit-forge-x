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
// same mechanism runs once, when the sequence is first scrolled into view.
//
// A fold is that button, and it says so: a panel that folds reports when it
// opens, and a sequence inside one runs from that instead of from geometry. It
// has to be the fold rather than the view, because a movement that opens into
// the lower third of a screen is born below anything an observer can see — and
// a reader who pressed a summary asking how something was decided has already
// said when they want the answer assembled.
//
// A reader who asked for reduced motion gets the finished sequence
// immediately. Nothing here is load-bearing: every figure is in the DOM from
// the first paint, and the states only change how it looks.

export type RailState = "waiting" | "running" | "settled";

/**
 * Settles `count` steps in order, once, when the returned ref's element comes
 * into view — or, given `armed`, once that turns true and wherever the list
 * happens to be. Attach the ref to the list; ask `state(i)` for each row.
 */
export function useRailReveal<T extends HTMLElement = HTMLOListElement>(
  count: number,
  opts: { stepMs?: number; startMs?: number; armed?: boolean } = {},
) {
  const { stepMs = 520, startMs = 160, armed } = opts;
  // How many have settled. `running` is the one after them, while there is one.
  const [settled, setSettled] = useState(0);
  const [done, setDone] = useState(false);
  const ref = useRef<T>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (started.current || count === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSettled(count);
      setDone(true);
      return;
    }
    const timers: number[] = [];
    const run = () => {
      started.current = true;
      for (let i = 1; i <= count; i += 1) {
        timers.push(window.setTimeout(() => {
          setSettled(i);
          if (i === count) setDone(true);
        }, startMs + i * stepMs));
      }
    };
    const clear = () => { for (const t of timers) window.clearTimeout(t); };

    // Given a trigger, that is the whole rule: run when it is armed.
    if (armed !== undefined) {
      if (armed) run();
      return clear;
    }
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (started.current || !entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
      // Not a fraction of the element: a movement can be taller than the
      // window, and asking for a third of it to be on screen is asking for
      // something that never happens — the run would never start at all. This
      // fires once the top of it is inside the reader's screen.
    }, { threshold: 0, rootMargin: "0px 0px -15% 0px" });
    io.observe(el);
    return () => { io.disconnect(); clear(); };
  }, [count, stepMs, startMs, armed]);

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

/**
 * How a plain row reads while the run is still reaching it: dim and a hair low,
 * then in place. For lists that are read rather than drawn — a table of checks,
 * a list of reasons — where the engine's bordered nodes would only add weight.
 */
export const railStep = (state: RailState) => cn(
  "transition-all duration-300 ease-out",
  "motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0",
  state === "waiting" ? "translate-y-0.5 opacity-40" : "translate-y-0 opacity-100");
