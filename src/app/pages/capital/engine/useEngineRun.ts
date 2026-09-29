import { useCallback, useEffect, useRef, useState } from "react";
import { TICK_MS } from "../../../lib/engine";

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/**
 * The clock of a run: a tick counter that advances until `total`, then stops.
 *
 * `holds` are the ticks it stops at and waits for `resume`, in order. There are
 * two of them on the engine page, and they are the seams of the story rather
 * than pauses for pacing: the credit engine has to qualify a request before
 * capital allocation is asked anything, and capital has to be allocated before
 * there is anything to follow. Each hold is a question the previous act left
 * open, so the button that releases it can name the next act.
 *
 * With reduced motion, or after Skip, it jumps straight to where it stops. It
 * only paces the showing of a result that is already computed.
 */
export function useEngineRun() {
  const [tick, setTick] = useState(-1);
  const [total, setTotal] = useState(0);
  const [holds, setHolds] = useState<number[]>([]);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };

  const runTo = useCallback((from: number, until: number) => {
    stop();
    if (reducedMotion()) {
      setTick(until);
      return;
    }
    setTick(from);
    timer.current = window.setInterval(() => {
      setTick((t) => {
        if (t + 1 >= until) stop();
        return Math.min(t + 1, until);
      });
    }, TICK_MS);
  }, []);

  const start = useCallback((ticks: number, holdAt: number[] = []) => {
    const hs = [...new Set(holdAt)].filter((h) => h > 0 && h < ticks).sort((a, b) => a - b);
    setTotal(ticks);
    setHolds(hs);
    runTo(0, hs.length > 0 ? hs[0] : ticks);
  }, [runTo]);

  const resume = useCallback(() => {
    if (holds.length === 0) return;
    const [from, ...rest] = holds;
    setHolds(rest);
    runTo(from, rest.length > 0 ? rest[0] : total);
  }, [holds, total, runTo]);

  const skip = useCallback(() => {
    stop();
    setTick(holds.length > 0 ? holds[0] : total);
  }, [holds, total]);

  const reset = useCallback(() => {
    stop();
    setTick(-1);
    setTotal(0);
    setHolds([]);
  }, []);

  useEffect(() => stop, []);

  const next = holds.length > 0 ? holds[0] : null;
  const held = next !== null && tick >= next;
  return {
    tick, total, started: tick >= 0, done: tick >= 0 && tick >= total, held, holding: next !== null,
    /** Which seam the run is waiting at, so the button can name the next act. */
    heldAt: held ? next : null,
    start, resume, skip, reset,
  };
}
