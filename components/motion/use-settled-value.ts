"use client";

import { useEffect, useRef, useState } from "react";

/** Longest wait for a quiet main thread before the new value is shown anyway. */
export const SETTLE_TIMEOUT_MS = 300;

type Cancel = () => void;

/** Runs `callback` once the browser is idle (or after `SETTLE_TIMEOUT_MS`); falls back to the frame after the next paint. */
function whenIdle(callback: () => void): Cancel {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: SETTLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(callback, 0);
  });
  return () => {
    cancelAnimationFrame(frame);
    if (timer !== undefined) clearTimeout(timer);
  };
}

/**
 * Returns `value`, but switches to a new one only when the main thread is free. Number animations run on the main
 * thread: started in the same moment as the render that brought the new data (charts, lists), they stop mid-roll and
 * then jump. The first value is returned immediately.
 */
export function useSettledValue<T>(value: T): T {
  const [settled, setSettled] = useState(value);
  const latest = useRef(value);
  const pending = useRef<Cancel | null>(null);

  useEffect(() => {
    latest.current = value;
    // A wait already scheduled picks up the latest value: rescheduling on every change would starve a dragged slider.
    if (pending.current || Object.is(value, settled)) return;
    pending.current = whenIdle(() => {
      pending.current = null;
      setSettled(latest.current);
    });
  }, [value, settled]);

  useEffect(
    () => () => {
      pending.current?.();
      pending.current = null;
    },
    [],
  );

  return settled;
}
