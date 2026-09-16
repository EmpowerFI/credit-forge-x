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
 * With reduced motion, or after Skip, it jumps straight to the end. It only
 * paces the showing of a result that is already computed.
 */
export function useEngineRun() {
  const [tick, setTick] = useState(-1);
  const [total, setTotal] = useState(0);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };

  const start = useCallback((ticks: number) => {
    stop();
    setTotal(ticks);
    if (reducedMotion()) {
      setTick(ticks);
      return;
    }
    setTick(0);
    timer.current = window.setInterval(() => {
      setTick((t) => {
        if (t + 1 >= ticks) stop();
        return Math.min(t + 1, ticks);
      });
    }, TICK_MS);
  }, []);

  const skip = useCallback(() => {
    stop();
    setTick(total);
  }, [total]);

  const reset = useCallback(() => {
    stop();
    setTick(-1);
    setTotal(0);
  }, []);

  useEffect(() => stop, []);

  return { tick, total, started: tick >= 0, done: tick >= 0 && tick >= total, start, skip, reset };
}
