// Cattura gli screenshot dell'app vera per la landing: una schermata per tema, da `content/screens.ts`.
// Prerequisiti (vedi docs/landing-screens.md): app in esecuzione su DEMO_APP_URL con il database popolato da
// `pnpm demo:seed`, e BETTER_AUTH_SECRET uguale a quello dell'app (serve a firmare il cookie di sessione demo).
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCREENS, SCREEN_THEMES } from "../content/screens.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = process.env.DEMO_APP_URL ?? "http://localhost:3300";
const SECRET = process.env.BETTER_AUTH_SECRET;
const TOKEN = process.env.DEMO_SESSION_TOKEN ?? "demo-session-token-0000000000000000";
const VIEWPORT = { width: 1280, height: 800 };
const SCALE = 1.5;
const JPEG_QUALITY = 80;
const SETTLE_MS = 1500;

if (!SECRET) throw new Error("Serve BETTER_AUTH_SECRET (lo stesso dell'app demo) per firmare il cookie di sessione.");

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

// Cookie firmato come fa better-auth: `token.firma`, con firma HMAC-SHA256 in base64, tutto codificato per URL.
const signature = createHmac("sha256", SECRET).update(TOKEN).digest("base64");
const cookieValue = encodeURIComponent(`${TOKEN}.${signature}`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const host = new URL(APP).hostname;
const manifest = { capturedAt: new Date().toISOString(), app: APP, viewport: VIEWPORT, scale: SCALE, screens: [] };

for (const theme of SCREEN_THEMES) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: theme, locale: "it-IT" });
  await context.addCookies([{ name: "better-auth.session_token", value: cookieValue, domain: host, path: "/" }]);
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const page = await context.newPage();
  mkdirSync(join(root, "public", "screens", theme), { recursive: true });
  for (const screen of SCREENS) {
    await page.goto(APP + screen.route, { waitUntil: "networkidle", timeout: 90_000 });
    if (new URL(page.url()).pathname !== screen.route) {
      throw new Error(`${screen.route}: l'app ha rimandato a ${page.url()} (sessione demo non valida o route cambiata)`);
    }
    if (screen.clickFirst) await page.getByRole("button", { name: screen.clickFirst, exact: true }).first().click();
    await page.waitForTimeout(SETTLE_MS);
    const file = join(root, "public", "screens", theme, `${screen.id}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: JPEG_QUALITY });
    manifest.screens.push({ id: screen.id, theme, route: screen.route });
    console.log(`${theme}/${screen.id}`);
  }
  await context.close();
}
await browser.close();
writeFileSync(join(root, "public", "screens", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
