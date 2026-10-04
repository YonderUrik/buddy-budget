import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCREENS, SCREEN_THEMES, screenSrc } from "./screens";

const LANDING_ROOT = join(__dirname, "..");
const APP_PAGES = join(LANDING_ROOT, "..", "app", "(app)");

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

  it("ha uno screenshot per ogni schermata e tema", () => {
    for (const screen of SCREENS)
      for (const theme of SCREEN_THEMES)
        expect(existsSync(join(LANDING_ROOT, "public", screenSrc(screen.id, theme))), `${theme}/${screen.id}`).toBe(true);
  });

  it("gli id sono unici", () => {
    const ids = SCREENS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
