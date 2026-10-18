import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_AREAS, FEATURE_AREA_LABELS_EN, FEATURES } from "./catalog.generated";
import { HOME_EN } from "./en/home";
import { AREA_META_EN } from "./feature-areas";
import { HOME_IT } from "./home";
import { EN_PATHS, HOME_PATH, PAGE_PAIRS, counterpart, languageAlternates } from "./locales";
import { SCREEN_TEXT_EN } from "./screen-text";
import { SCREENS } from "./screens";
import { APP_URL, LOCALE_APP_LINKS } from "./site";
import { UI } from "./ui";

const APP_DIR = join(__dirname, "..", "app");

/** Source file of the page at `path` in one language (`app/(it)/…/page.tsx` or `app/en/…/page.tsx`). */
function pageFile(path: string, locale: "it" | "en"): string {
  if (locale === "en") return join(APP_DIR, ...path.split("/").filter(Boolean), "page.tsx");
  return join(APP_DIR, "(it)", ...path.split("/").filter(Boolean), "page.tsx");
}

/** Paths of every page under `app/en`. */
function englishRoutes(dir = join(APP_DIR, "en"), prefix = "/en"): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return englishRoutes(full, `${prefix}/${name}`);
    return name === "page.tsx" ? [prefix] : [];
  });
}

describe("language pairs", () => {
  it("every pair has an Italian and an English page that set hreflang", () => {
    for (const pair of PAGE_PAIRS) {
      for (const locale of ["it", "en"] as const) {
        const file = pageFile(pair[locale], locale);
        expect(existsSync(file), `${pair[locale]} → ${file}`).toBe(true);
        expect(readFileSync(file, "utf8"), `${pair[locale]} does not set its alternates`).toMatch(/languageAlternates\(/);
      }
    }
  });

  it("every English page has an Italian counterpart", () => {
    const routes = englishRoutes();
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) expect(PAGE_PAIRS.map((p) => p.en), route).toContain(route);
  });

  it("hreflang names both languages and an English x-default", () => {
    for (const pair of PAGE_PAIRS) {
      for (const locale of ["it", "en"] as const) {
        const alt = languageAlternates(pair[locale], locale);
        expect(alt.canonical).toBe(pair[locale]);
        expect(alt.languages).toEqual({ it: pair.it, en: pair.en, "x-default": pair.en });
      }
    }
  });

  it("the switch goes to the same page, or to the other language's home", () => {
    for (const pair of PAGE_PAIRS) {
      expect(counterpart(pair.it, "en")).toBe(pair.en);
      expect(counterpart(pair.en, "it")).toBe(pair.it);
    }
    expect(counterpart("/pagina-solo-italiana", "en")).toBe(HOME_PATH.en);
  });

  it("the English menu and footer link pages that exist", () => {
    const enPaths = new Set<string>(Object.values(EN_PATHS));
    for (const link of [...UI.en.nav.links, ...UI.en.footer.links]) {
      if (link.href.startsWith("/en")) expect(enPaths.has(link.href), link.href).toBe(true);
      else expect(link.label, `${link.href} is Italian-only: say so`).toMatch(/\(Italian\)$/);
    }
  });
});

describe("English texts", () => {
  it("every catalog entry and area has an English text", () => {
    for (const feature of FEATURES) expect(feature.en?.name && feature.en.description, feature.id).toBeTruthy();
    for (const area of FEATURE_AREAS) {
      expect(FEATURE_AREA_LABELS_EN[area]).toBeTruthy();
      expect(AREA_META_EN[area].intro).toBeTruthy();
    }
  });

  it("every screen has an English label, caption and alt text", () => {
    for (const screen of SCREENS) {
      const text = SCREEN_TEXT_EN[screen.id];
      expect(text.label && text.caption && text.alt, screen.id).toBeTruthy();
    }
  });

  it("the English home has the same sections and figures as the Italian one", () => {
    expect(HOME_EN.sum.rows.map((r) => r.value)).toEqual(HOME_IT.sum.rows.map((r) => r.value));
    expect(HOME_EN.places.items.length).toBe(HOME_IT.places.items.length);
    expect(HOME_EN.showcase.tabs.map((t) => [t.id, t.shot])).toEqual(HOME_IT.showcase.tabs.map((t) => [t.id, t.shot]));
    expect(HOME_EN.trust.facts.length).toBe(HOME_IT.trust.facts.length);
  });

  it("Italian-only destinations on the English home say so", () => {
    for (const tab of HOME_EN.showcase.tabs) if (tab.more && !tab.more.href.startsWith("/en")) expect(tab.more.label, tab.id).toMatch(/\(in Italian\)$/);
  });
});

describe("demo links", () => {
  it("go to the app's public demo, in English from the English pages", () => {
    expect(LOCALE_APP_LINKS.it.demo).toBe(`${APP_URL}/demo`);
    expect(LOCALE_APP_LINKS.en.demo).toBe(`${APP_URL}/demo?lang=en`);
  });
});
