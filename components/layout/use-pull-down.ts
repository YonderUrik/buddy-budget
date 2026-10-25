"use client";

/**
 * usePullDown
 *
 * Pulling the page down from its top opens something, as Spotlight on the iPhone home screen. Follows one finger on the
 * app's scrolling container: the gesture starts only when the page (and every scrolling box under the finger) is at
 * its top, mostly vertical and downwards; past `PULL_THRESHOLD_PX` of damped travel, letting go calls `onPull`. Returns
 * the damped travel for the hint that follows the finger (0 when idle). `onPull` undefined listens to nothing.
 */

import { useEffect, useRef, useState } from "react";

/** Damped travel (px) after which letting go opens: about 110 px of finger on the glass. */
export const PULL_THRESHOLD_PX = 56;
/** Finger travel (px) before deciding whether the gesture is a pull, a scroll or a horizontal swipe. */
const PULL_SLOP_PX = 10;
/** Damping of the finger travel: the hint moves slower than the finger, like a rubber band, and stops at `PULL_MAX_PX`. */
const PULL_RESISTANCE = 0.5;
const PULL_MAX_PX = 96;

/** Damped travel for `dy` px of finger travel downwards. */
export function pullDistance(dy: number): number {
  return Math.min(PULL_MAX_PX, Math.max(0, dy) * PULL_RESISTANCE);
}

/** True when `target` sits in a box that scrolls and is not at its top (the pull belongs to that box), up to `root`. */
function scrolledInside(target: EventTarget | null, root: HTMLElement): boolean {
  for (let node = target instanceof Element ? target : null; node && node !== root; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
    if (node.matches("input, textarea, select, [contenteditable='true'], [data-no-pull]")) return true;
  }
  return false;
}

export function usePullDown(containerId: string, onPull: (() => void) | undefined): number {
  const [distance, setDistance] = useState(0);
  const onPullRef = useRef(onPull);
  useEffect(() => {
    onPullRef.current = onPull;
  });
  const enabled = onPull !== undefined;

  useEffect(() => {
    if (!enabled) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    let start: { x: number; y: number } | null = null;
    let pulling = false;
    let travel = 0;
    let frame = 0;

    const atTop = () => container.scrollTop <= 0 && window.scrollY <= 0;
    const paint = () => {
      frame = 0;
      setDistance(travel);
    };
    const reset = () => {
      start = null;
      pulling = false;
      travel = 0;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      setDistance(0);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !atTop() || scrolledInside(event.target, container)) return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      pulling = false;
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const dx = event.touches[0].clientX - start.x;
      const dy = event.touches[0].clientY - start.y;
      if (!pulling) {
        if (Math.abs(dx) < PULL_SLOP_PX && Math.abs(dy) < PULL_SLOP_PX) return;
        // Up, sideways or after the page moved: an ordinary scroll or swipe, not a pull.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || !atTop()) {
          start = null;
          return;
        }
        pulling = true;
      }
      travel = pullDistance(dy - PULL_SLOP_PX);
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onEnd = () => {
      const open = pulling && travel >= PULL_THRESHOLD_PX;
      reset();
      if (open) onPullRef.current?.();
    };

    container.addEventListener("touchstart", onStart, { passive: true });
    container.addEventListener("touchmove", onMove, { passive: true });
    container.addEventListener("touchend", onEnd);
    container.addEventListener("touchcancel", reset);
    return () => {
      container.removeEventListener("touchstart", onStart);
      container.removeEventListener("touchmove", onMove);
      container.removeEventListener("touchend", onEnd);
      container.removeEventListener("touchcancel", reset);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerId, enabled]);

  return enabled ? distance : 0;
}
