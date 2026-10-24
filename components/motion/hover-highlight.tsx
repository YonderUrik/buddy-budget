"use client";

import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Transition } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * How the highlight travels between items: `follow` glides after the pointer with a slight lag, `stretch` reaches the
 * new item with its leading edge first and pulls the trailing edge after it.
 */
export type HoverHighlightMode = "follow" | "stretch";

export interface HoverHighlightProps {
  children: React.ReactNode;
  /** Classes of the moving highlight (colour and radius); it is drawn behind the items. */
  highlightClassName?: string;
  mode?: HoverHighlightMode;
  className?: string;
}

/** Attribute that marks an element as a stop for the highlight. */
export const HOVER_TARGET_ATTRIBUTE = "data-hover-target";

/** Lagging spring of `follow`: soft enough that the highlight visibly catches up with the pointer. */
const FOLLOW_SPRING: Transition = { type: "spring", stiffness: 210, damping: 24, mass: 0.9 };
/** `stretch`: the leading edge moves fast, the trailing edge follows later and slower. */
const LEADING_SPRING: Transition = { type: "spring", stiffness: 520, damping: 38 };
const TRAILING_SPRING: Transition = { type: "spring", stiffness: 170, damping: 22, delay: 0.04 };
const FADE: Transition = { duration: 0.16 };
/**
 * How much taller than the item the stretching highlight may get: on a fast sweep across many items the leading edge
 * runs far ahead, and without a cap the highlight would swell into a bubble covering several rows.
 */
const MAX_STRETCH = 1.4;

/**
 * A highlight that slides behind a vertical list on hover and keyboard focus, from one item to the next, instead of
 * each item lighting up on its own. Items opt in with `data-hover-target`. It enters in place (no slide from the last
 * item it left), fades out when the pointer leaves the list, and jumps without motion under reduced motion. It is drawn
 * under the items' content (the list becomes its own stacking context), so rows need no extra positioning; a row with
 * its own background hides it. Each row drops its own `hover:bg-*`.
 */
export function HoverHighlight({ children, highlightClassName, mode = "follow", className }: HoverHighlightProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const top = useMotionValue(0);
  const bottom = useMotionValue(0);
  const opacity = useMotionValue(0);
  // Horizontal bounds follow the item too, so indented or narrower rows get a highlight of their own width.
  const left = useMotionValue(0);
  const width = useMotionValue(0);
  const visible = React.useRef(false);
  /** Direction of the last move and height of the item reached: the trailing edge never lags more than the cap. */
  const goingDown = React.useRef(true);
  const itemHeight = React.useRef(0);
  const y = useTransform(() => {
    const maxHeight = itemHeight.current * MAX_STRETCH;
    return goingDown.current ? Math.max(top.get(), bottom.get() - maxHeight) : top.get();
  });
  const height = useTransform(() => {
    const maxHeight = itemHeight.current * MAX_STRETCH;
    return Math.max(0, Math.min(bottom.get() - top.get(), maxHeight));
  });

  const moveTo = React.useCallback(
    (target: HTMLElement) => {
      const container = containerRef.current;
      if (!container) return;
      const box = container.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const nextTop = rect.top - box.top;
      const nextBottom = rect.bottom - box.top;
      if (visible.current && !reduced) {
        // Start from what is drawn: an edge held back by the cap must not jump when the direction changes.
        const drawnTop = y.get();
        const drawnBottom = drawnTop + height.get();
        if (top.get() !== drawnTop) top.set(drawnTop);
        if (bottom.get() !== drawnBottom) bottom.set(drawnBottom);
      }
      goingDown.current = nextTop >= top.get();
      itemHeight.current = rect.height;
      const nextLeft = rect.left - box.left;
      if (!visible.current || reduced) {
        top.jump(nextTop);
        bottom.jump(nextBottom);
        left.jump(nextLeft);
        width.jump(rect.width);
      } else if (mode === "stretch") {
        const down = goingDown.current;
        animate(top, nextTop, down ? TRAILING_SPRING : LEADING_SPRING);
        animate(bottom, nextBottom, down ? LEADING_SPRING : TRAILING_SPRING);
      } else {
        animate(top, nextTop, FOLLOW_SPRING);
        animate(bottom, nextBottom, FOLLOW_SPRING);
      }
      if (visible.current && !reduced) {
        animate(left, nextLeft, LEADING_SPRING);
        animate(width, rect.width, LEADING_SPRING);
      }
      visible.current = true;
      animate(opacity, 1, reduced ? { duration: 0 } : FADE);
    },
    [bottom, height, left, mode, opacity, reduced, top, width, y]
  );

  const hide = React.useCallback(() => {
    visible.current = false;
    animate(opacity, 0, reduced ? { duration: 0 } : FADE);
  }, [opacity, reduced]);

  const targetOf = (node: EventTarget | null) =>
    node instanceof Element ? node.closest<HTMLElement>(`[${HOVER_TARGET_ATTRIBUTE}]`) : null;

  return (
    <div
      ref={containerRef}
      className={cn("relative isolate", className)}
      onPointerOver={(event) => {
        const target = targetOf(event.target);
        if (target) moveTo(target);
      }}
      onPointerLeave={hide}
      onFocus={(event) => {
        const target = targetOf(event.target);
        if (target && event.target instanceof HTMLElement && event.target.matches(":focus-visible")) moveTo(target);
      }}
      onBlur={hide}
    >
      <motion.span
        aria-hidden="true"
        className={cn("pointer-events-none absolute top-0 left-0 -z-10", highlightClassName)}
        style={{ x: left, y, width, height, opacity }}
      />
      {children}
    </div>
  );
}
