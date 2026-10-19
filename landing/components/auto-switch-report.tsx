"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { AUTO_SWITCH_FLAG } from "@/lib/visitor-country";

/** How often (ms) and how many times to look for the Umami tracker, which loads after the page. */
const POLL_MS = 500;
const MAX_TRIES = 20;

/**
 * English pages: when the visitor got here from an Italian page by the switch by country (the boot script left a
 * sessionStorage flag, Umami was not loaded yet), sends `language_auto_switched` once the tracker is there. Renders
 * nothing; the country itself is never sent.
 */
export function AutoSwitchReport() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(AUTO_SWITCH_FLAG) !== "1") return;
      sessionStorage.removeItem(AUTO_SWITCH_FLAG);
    } catch {
      return;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if ((window as unknown as { umami?: unknown }).umami) {
        track("language_auto_switched", { from: "it", to: "en" });
        window.clearInterval(timer);
      } else if (tries >= MAX_TRIES) window.clearInterval(timer);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
