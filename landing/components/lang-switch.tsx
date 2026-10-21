"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef } from "react";
import "./lang-switch.css";
import { track, type LandingEvents } from "@/lib/analytics";
import { HTML_LANG, LOCALE_NAME, LOCALES, type Locale } from "@/lib/i18n";
import { rememberLanguageChoice } from "@/lib/visitor-country";

export interface LangSwitchProps {
  /** Language of the current page (listed with a check, not linked). */
  locale: Locale;
  /** The same page in every language, or that language's home (`counterpart` in `content/locales.ts`). */
  hrefs: Record<Locale, string>;
  location: LandingEvents["language_switch_click"]["location"];
  /** `aria-label` of the menu. */
  label: string;
  /** Open the list upwards (footer, bottom of the phone menu). */
  up?: boolean;
  className?: string;
}

/**
 * Language menu: a button with the current language written in itself, opening the list of every language, each
 * in its own name. Built to hold many languages, not only two. A `<details>` so it works without script; script only
 * closes it on a click outside or Escape. Links are plain `<a>` (each language has its own root layout). A choice
 * is remembered (the switch by country never overrides it) and sends `language_switch_click`.
 */
export function LangSwitch({ locale, hrefs, location, label, up, className }: LangSwitchProps) {
  const root = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onPointer = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={root} className={`lang${up ? " up" : ""}${className ? ` ${className}` : ""}`}>
      <summary aria-label={`${label}: ${LOCALE_NAME[locale]}`}>
        <Globe size={16} strokeWidth={1.75} aria-hidden="true" />
        <span>{LOCALE_NAME[locale]}</span>
        <ChevronDown className="lang-chev" size={14} strokeWidth={2} aria-hidden="true" />
      </summary>
      <ul aria-label={label}>
        {LOCALES.map((l) => (
          <li key={l}>
            {l === locale ? (
              <span className="lang-item" aria-current="true" lang={HTML_LANG[l]}>
                {LOCALE_NAME[l]}
                <Check size={16} strokeWidth={2} aria-hidden="true" />
              </span>
            ) : (
              <a className="lang-item" href={hrefs[l]} hrefLang={HTML_LANG[l]} lang={HTML_LANG[l]} onClick={() => {
                  rememberLanguageChoice(l);
                  track("language_switch_click", { from: locale, to: l, location });
                }}>
                {LOCALE_NAME[l]}
              </a>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
