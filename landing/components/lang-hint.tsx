"use client";

import { X } from "lucide-react";
import "./lang-hint.css";
import { track } from "@/lib/analytics";
import { LANG_HINT_STORAGE_KEY } from "@/lib/lang-hint";
import { rememberLanguageChoice } from "@/lib/visitor-country";

export interface LangHintProps {
  /** The English page to suggest. */
  href: string;
  text: string;
  /** Accessible name of the close button. */
  dismiss: string;
}

/**
 * Thin bar above the bar of the Italian home: «This page is also available in English →». It is in the HTML but
 * hidden; the boot script of the Italian layout shows it (`html[data-lang-hint]`) before the first paint when the
 * browser's preferred language is not Italian and it was never closed, so nothing moves after load. Never a redirect.
 */
export function LangHint({ href, text, dismiss }: LangHintProps) {
  const close = () => {
    delete document.documentElement.dataset.langHint;
    try {
      localStorage.setItem(LANG_HINT_STORAGE_KEY, "1");
    } catch {
      // storage blocked: the bar comes back on the next visit
    }
    track("language_hint_dismissed");
  };

  return (
    <div className="lang-hint" lang="en">
      <div className="wrap">
        <a href={href} hrefLang="en" onClick={() => {
            rememberLanguageChoice("en");
            track("language_switch_click", { from: "it", to: "en", location: "hint" });
          }}>
          {text} <span aria-hidden="true">→</span>
        </a>
        <button type="button" onClick={close} aria-label={dismiss}>
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
