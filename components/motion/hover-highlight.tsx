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
 * A highlight that slides behind a vertical list on hover and keyboard focus, from one item to the next, instead of
 * each item lighting up on its own. Items opt in with `data-hover-target`. It enters in place (no slide from the last
 * item it left), fades out when the pointer leaves the list, and jumps without motion under reduced motion.
 */
export function HoverHighlight({ children, highlightClassName, mode = "follow", className }: HoverHighlightProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const top = useMotionValue(0);
  const bottom = useMotionValue(0);
  const opacity = useMotionValue(0);
  const height = useTransform(() => bottom.get() - top.get());
  const visible = React.useRef(false);

  const moveTo = React.useCallback(
    (target: HTMLElement) => {
      const container = containerRef.current;
      if (!container) return;
      const box = container.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const nextTop = rect.top - box.top;
      const nextBottom = rect.bottom - box.top;
      if (!visible.current || reduced) {
        top.jump(nextTop);
        bottom.jump(nextBottom);
      } else if (mode === "stretch") {
        const goingDown = nextTop > top.get();
        animate(top, nextTop, goingDown ? TRAILING_SPRING : LEADING_SPRING);
        animate(bottom, nextBottom, goingDown ? LEADING_SPRING : TRAILING_SPRING);
      } else {
        animate(top, nextTop, FOLLOW_SPRING);
        animate(bottom, nextBottom, FOLLOW_SPRING);
      }
      visible.current = true;
      animate(opacity, 1, reduced ? { duration: 0 } : FADE);
    },
    [bottom, mode, opacity, reduced, top]
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
      className={cn("relative", className)}
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
        className={cn("pointer-events-none absolute inset-x-0 top-0", highlightClassName)}
        style={{ y: top, height, opacity }}
      />
      {children}
    </div>
  );
}
