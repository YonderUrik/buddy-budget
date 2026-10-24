"use client";

/**
 * useCompactOnScroll
 *
 * True while the phone bottom bar should be compact: follows the scroll of the given container (the app's `<main>`)
 * and of the document, which also scrolls on some pages, through `nextCompactState`. Reads one offset per frame and
 * goes back to full on every page change. `enabled = false` keeps it full and listens to nothing.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { INITIAL_COMPACT_STATE, nextCompactState } from "@/lib/navigation";

export function useCompactOnScroll(containerId: string, enabled = true): boolean {
  const pathname = usePathname();
  // The page the bar was made compact on: a new page starts full without resetting state in the effect.
  const [compactOn, setCompactOn] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const container = document.getElementById(containerId);
    let state = INITIAL_COMPACT_STATE;
    let frame = 0;
    let source: "container" | "document" = "container";

    const read = () => {
      frame = 0;
      const doc = document.documentElement;
      const y = source === "container" && container ? container.scrollTop : window.scrollY;
      const maxY = source === "container" && container ? container.scrollHeight - container.clientHeight : doc.scrollHeight - window.innerHeight;
      state = nextCompactState(state, y, maxY);
      setCompactOn(state.compact ? pathname : null);
    };
    const schedule = (from: "container" | "document") => () => {
      // A new source starts from its own offset, never from the other one's anchor.
      if (from !== source) state = INITIAL_COMPACT_STATE;
      source = from;
      if (!frame) frame = requestAnimationFrame(read);
    };
    const onContainer = schedule("container");
    const onDocument = schedule("document");
    container?.addEventListener("scroll", onContainer, { passive: true });
    window.addEventListener("scroll", onDocument, { passive: true });
    return () => {
      container?.removeEventListener("scroll", onContainer);
      window.removeEventListener("scroll", onDocument);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerId, enabled, pathname]);

  return enabled && compactOn === pathname;
}
