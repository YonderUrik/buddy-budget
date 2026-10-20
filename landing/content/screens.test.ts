import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCREENS, SCREEN_LANGUAGES, SCREEN_THEMES, screenLanguage, screenPhoneSrc, screenSmallSrc, screenSrc } from "./screens";

const LANDING_ROOT = join(__dirname, "..");
const APP_PAGES = join(LANDING_ROOT, "..", "app", "(app)");
/** The app's country rules, loaded by path: the landing image builds from `landing/` alone, so no static import of app code. */
const APP_LOCALIZATION = join(LANDING_ROOT, "..", "lib", "localization", "config.ts");

/** Route dell'app (pathname) ricavate dalle cartelle `page.tsx` sotto `app/(app)`, ignorando i gruppi `(x)`. */
function appRoutes(dir = APP_PAGES, prefix = ""): string[] {
  const routes: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === "page.tsx") routes.push(prefix || "/");
      continue;
    }
    const segment = name.startsWith("(") ? "" : `/${name}`;
    routes.push(...appRoutes(full, prefix + segment));
  }
  return routes;
}

describe("schermate della landing", () => {
  const routes = appRoutes();

  it("ogni schermata punta a una route che esiste nell'app", () => {
    for (const screen of SCREENS) expect(routes, `${screen.id} → ${screen.route}`).toContain(screen.route);
  });

  it("has a screenshot for every screen, theme and language", () => {
    for (const language of SCREEN_LANGUAGES)
      for (const screen of SCREENS)
        for (const theme of SCREEN_THEMES) {
          const label = `${language}/${theme}/${screen.id}`;
          expect(existsSync(join(LANDING_ROOT, "public", screenSrc(screen.id, theme, false, language))), label).toBe(true);
          expect(existsSync(join(LANDING_ROOT, "public", screenSmallSrc(screen.id, theme, language))), `${label}-sm`).toBe(true);
          if ("topCrop" in screen && screen.topCrop)
            expect(existsSync(join(LANDING_ROOT, "public", screenSrc(screen.id, theme, true, language))), `${label}-top`).toBe(true);
          if ("phone" in screen && screen.phone)
            expect(existsSync(join(LANDING_ROOT, "public", screenPhoneSrc(screen.id, theme, language))), `${label}-phone`).toBe(true);
        }
  });

  it("marks a screen unavailable exactly where the app's country rules hide it", async () => {
    const { isCountryPathAvailable, profileForLanguage } = (await import(/* @vite-ignore */ APP_LOCALIZATION)) as {
      isCountryPathAvailable: (country: string, path: string) => boolean;
      profileForLanguage: (language: string) => { productCountry: string };
    };
    for (const language of SCREEN_LANGUAGES)
      for (const screen of SCREENS) {
        const available = isCountryPathAvailable(profileForLanguage(language).productCountry, screen.route);
        const unavailableIn: readonly string[] = "unavailableIn" in screen ? screen.unavailableIn : [];
        expect(unavailableIn.includes(language), `${language}/${screen.id}`).toBe(!available);
      }
  });

  it("falls back to a language where the screen exists", () => {
    expect(screenLanguage("pensione", "de")).toBe("en");
    expect(screenLanguage("panoramica", "de")).toBe("de");
    expect(screenSrc("pensione", "dark", false, "de")).toBe("/screens/en/dark/pensione.webp");
    expect(screenSrc("panoramica", "light")).toBe("/screens/light/panoramica.webp");
  });

  it("una schermata con segmento dinamico dice come aprirla", () => {
    for (const screen of SCREENS) if (screen.route.includes("[")) expect("open" in screen && screen.open, `${screen.id}`).toBeTruthy();
  });

  it("gli id sono unici", () => {
    const ids = SCREENS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
