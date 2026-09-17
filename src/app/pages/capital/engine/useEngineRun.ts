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
 * With `hold`, it first stops there and waits for `resume`: the credit engine
 * qualifies before capital allocation is run. With reduced motion, or after
 * Skip, it jumps straight to where it stops. It only paces the showing of a
 * result that is already computed.
 */
export function useEngineRun() {
  const [tick, setTick] = useState(-1);
  const [total, setTotal] = useState(0);
  const [hold, setHold] = useState<number | null>(null);
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

  const start = useCallback((ticks: number, holdAt: number | null = null) => {
    setTotal(ticks);
    setHold(holdAt !== null && holdAt < ticks ? holdAt : null);
    runTo(0, holdAt !== null && holdAt < ticks ? holdAt : ticks);
  }, [runTo]);

  const resume = useCallback(() => {
    if (hold === null) return;
    const from = hold;
    setHold(null);
    runTo(from, total);
  }, [hold, total, runTo]);

  const skip = useCallback(() => {
    stop();
    setTick(hold ?? total);
  }, [hold, total]);

  const reset = useCallback(() => {
    stop();
    setTick(-1);
    setTotal(0);
    setHold(null);
  }, []);

  useEffect(() => stop, []);

  const held = hold !== null && tick >= hold;
  return {
    tick, total, started: tick >= 0, done: tick >= 0 && tick >= total, held, holding: hold !== null,
    start, resume, skip, reset,
  };
}
