"use client";

import { useEffect } from "react";

/** Share of a block that must be on screen before it rises in. */
const RISE_THRESHOLD = 0.15;

/**
 * Marks every `[data-rise]` block with `data-in` (an attribute, not a class: React rewrites `className` on re-render and would hide the block again) the first time it comes into view, so the CSS entrance in `globals.css`
 * plays once (opacity and a 24 px rise, staggered by `--i`). Mounted once per page by `RootDocument`; it watches the
 * DOM for blocks added later. Without IntersectionObserver every block is shown at once.
 */
export function RiseObserver() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("js-motion")) return;
    const showAll = () => document.querySelectorAll("[data-rise]").forEach((el) => el.setAttribute("data-in", ""));
    if (!("IntersectionObserver" in window)) {
      showAll();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-in", "");
          io.unobserve(entry.target);
        }
      },
      { threshold: RISE_THRESHOLD },
    );
    const watch = () => document.querySelectorAll("[data-rise]:not([data-in])").forEach((el) => io.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
