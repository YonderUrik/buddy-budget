import { DEFAULT_SCREEN_LANGUAGE, SCREEN_LANGUAGES, SCREEN_THEMES, type ScreenLanguage, type ScreenTheme } from "@/content/screens";

export interface ScreenVariant {
  language: ScreenLanguage;
  theme: ScreenTheme;
  /** Classes the CSS of `app-shot.css` uses to show only the visitor's language and the current theme. */
  className: string;
  /** Loaded eagerly: only the default language of an above-the-fold image (the others are hidden until chosen). */
  eager: boolean;
}

/**
 * Every language × theme version of a screenshot. All are rendered and the CSS shows one, so neither the theme nor
 * the language swaps an image after load; hidden lazy images are never downloaded.
 */
export function screenVariants(priority = false): ScreenVariant[] {
  return SCREEN_LANGUAGES.flatMap((language) =>
    SCREEN_THEMES.map((theme) => ({
      language,
      theme,
      className: `shot-img shot-${theme} shot-lang-${language}`,
      eager: priority && language === DEFAULT_SCREEN_LANGUAGE,
    })),
  );
}

/**
 * Inline script run before the first paint: picks the screenshots' language from `?lang=` or the browser's preferred
 * languages (first supported one; English when none is supported) and stores it in `<html data-screens>`. Italian,
 * the default, sets nothing, so the page works the same without JavaScript.
 */
export const SCREEN_LANGUAGE_SCRIPT = `try{var l=new URLSearchParams(location.search).get("lang"),s=${JSON.stringify(SCREEN_LANGUAGES)},p=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""]).map(function(x){return String(x).toLowerCase().split("-")[0]}).filter(Boolean);if(s.indexOf(l)<0){l=null;for(var i=0;i<p.length&&!l;i++)if(s.indexOf(p[i])>=0)l=p[i];if(!l&&p.length)l="en"}if(l&&l!=="${DEFAULT_SCREEN_LANGUAGE}")document.documentElement.dataset.screens=l}catch(e){}`;
