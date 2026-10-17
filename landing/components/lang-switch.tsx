"use client";

import { Fragment } from "react";
import "./lang-switch.css";
import { track, type LandingEvents } from "@/lib/analytics";
import { HTML_LANG, LOCALE_SHORT, LOCALES, type Locale } from "@/lib/i18n";

export interface LangSwitchProps {
  /** Language of the current page (shown, not linked). */
  locale: Locale;
  /** The same page in the other language, or that language's home (`counterpart` in `content/locales.ts`). */
  href: string;
  location: LandingEvents["language_switch_click"]["location"];
  /** `aria-label` of the group. */
  label: string;
  className?: string;
}

/**
 * «IT / EN»: the current language in bold, the other one a link to the same page in that language. A plain `<a>`,
 * not `next/link`: the two languages have different root layouts, so the browser loads the page anyway. The click
 * sends `language_switch_click`.
 */
export function LangSwitch({ locale, href, location, label, className }: LangSwitchProps) {
  return (
    <span className={`lang${className ? ` ${className}` : ""}`} role="group" aria-label={label}>
      {LOCALES.map((l, i) => (
        <Fragment key={l}>
          {i > 0 ? <span aria-hidden="true">/</span> : null}
          {l === locale ? (
            <b aria-current="true">{LOCALE_SHORT[l]}</b>
          ) : (
            <a href={href} hrefLang={HTML_LANG[l]} lang={HTML_LANG[l]} onClick={() => track("language_switch_click", { from: locale, to: l, location })}>
              {LOCALE_SHORT[l]}
            </a>
          )}
        </Fragment>
      ))}
    </span>
  );
}
