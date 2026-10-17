// Captures real app screenshots for the landing: one per screen of `content/screens.ts`, theme and interface language.
// Prerequisites (see docs/landing-screens.md): the app running at DEMO_APP_URL on a database filled by `pnpm demo:seed`
// (with DEMO_LANGUAGE equal to CAPTURE_LANGUAGE), and the app's BETTER_AUTH_SECRET (it signs the demo session cookie).
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SCREEN_LANGUAGE, SCREENS, SCREEN_LANGUAGES, SCREEN_THEMES, screenDir } from "../content/screens.ts";
import { findDemoText } from "../../scripts/demo-seed-texts.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = process.env.DEMO_APP_URL ?? "http://localhost:3300";
const SECRET = process.env.BETTER_AUTH_SECRET;
const TOKEN = process.env.DEMO_SESSION_TOKEN ?? "demo-session-token-0000000000000000";
const VIEWPORT = { width: 1280, height: 800 };
const SCALE = 1.5;
/** Telefono: primo schermo a misura di iPhone, 2x (per la cornice da telefono della home). */
// An iPhone screen (390×844) minus status bar (59) and home indicator (34): the viewport the app gets when installed
// on the phone, and exactly the app area of the landing's `PhoneFrame`.
const PHONE = { width: 390, height: 751 };
const PHONE_SCALE = 2;
const JPEG_QUALITY = 80;
const SETTLE_MS = 1500;
/** Altezza massima (px CSS) di uno screenshot: la pagina si cattura intera fin qui, così non si vede solo la parte alta. */
const MAX_HEIGHT = 1500;

// CAPTURE_LANGUAGE=en|de captures the screens in that interface language: the demo must be seeded in the same language
// (`DEMO_LANGUAGE`), and the images go to `public/screens/<language>/` at the same sizes as the Italian ones.
const LANGUAGE = process.env.CAPTURE_LANGUAGE ?? DEFAULT_SCREEN_LANGUAGE;
if (!SCREEN_LANGUAGES.includes(LANGUAGE)) throw new Error(`CAPTURE_LANGUAGE must be one of ${SCREEN_LANGUAGES.join(", ")}`);
const BROWSER_LOCALES = { it: "it-IT", en: "en-GB", de: "de-DE" };
const catalog = LANGUAGE === DEFAULT_SCREEN_LANGUAGE ? {} : JSON.parse(readFileSync(join(root, "..", "lib", "localization", "catalogs", `${LANGUAGE}.json`), "utf8"));
/** Text written in Italian in `screens.ts` (button, label, demo name) as the app shows it in the captured language. */
const tr = (text) => (LANGUAGE === DEFAULT_SCREEN_LANGUAGE ? text : catalog[text] ?? findDemoText(text, LANGUAGE) ?? text);

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
// ONLY=id1,id2 rigenera solo quelle schermate (utile quando se ne aggiunge una) e conserva il resto del manifest.
const ONLY = process.env.ONLY?.split(",").map((id) => id.trim()).filter(Boolean);
// PHONE_ONLY=1 regenerates only the phone versions (`<id>-phone.jpg`) and keeps the full-size dimensions in the manifest.
const PHONE_ONLY = process.env.PHONE_ONLY === "1";
const manifest = { capturedAt: new Date().toISOString(), app: APP, language: LANGUAGE, viewport: VIEWPORT, scale: SCALE, phone: PHONE, phoneScale: PHONE_SCALE, screens: [] };
// Screens the demo account cannot open in this language (German product rules) are skipped: the landing falls back.
const selected = SCREENS.filter((candidate) => (!ONLY || ONLY.includes(candidate.id)) && !candidate.unavailableIn?.includes(LANGUAGE));
const screensDir = (theme) => join(root, "public", screenDir(LANGUAGE, theme));
const manifestPath = join(root, "public", "screens", ...(LANGUAGE === DEFAULT_SCREEN_LANGUAGE ? [] : [LANGUAGE]), "manifest.json");
// Other languages reuse the Italian heights, so every language of a screen has the same size and the landing only
// swaps the image (the Italian capture runs first).
const reference = LANGUAGE === DEFAULT_SCREEN_LANGUAGE ? null : JSON.parse(readFileSync(join(root, "public", "screens", "manifest.json"), "utf8"));
const referenceHeight = (id, theme) => {
  const entry = reference?.screens.find((candidate) => candidate.id === id && candidate.theme === theme);
  return entry ? Math.round(entry.height / SCALE) : null;
};

/** La route con un segmento dinamico (`[id]`) accetta qualunque valore in quel punto. */
function routeMatches(route, pathname) {
  const pattern = route
    .split("/")
    .map((segment) => (segment.startsWith("[") ? "[^/]+" : segment.replace(/[.*+?^${}()|\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${pattern}$`).test(pathname);
}

/** Apre la pagina di una schermata (direttamente, o passando dalla pagina che la linka) e la prepara allo scatto. */
async function openScreen(page, screen) {
  const target = screen.open ? screen.open.route : screen.route;
  const response = await page.goto(APP + target, { waitUntil: "networkidle", timeout: 90_000 });
  if (!response || !response.ok()) throw new Error(`${target}: risposta ${response?.status() ?? "assente"}, l'app non sta servendo la pagina`);
  if (new URL(page.url()).pathname !== target) {
    throw new Error(`${target}: l'app ha rimandato a ${page.url()} (sessione demo non valida o route cambiata)`);
  }
  if (screen.open) {
    await page.getByRole("link", { name: tr(screen.open.clickText) }).first().click();
    await page.waitForURL((url) => routeMatches(screen.route, url.pathname), { timeout: 60_000 });
    await page.waitForLoadState("networkidle");
  }
  const language = await page.evaluate(() => document.documentElement.lang);
  if (language !== LANGUAGE) throw new Error(`${target}: the app is in "${language}", not "${LANGUAGE}" (seed the demo with DEMO_LANGUAGE=${LANGUAGE})`);
  if (screen.clickFirst) await page.getByRole("button", { name: tr(screen.clickFirst), exact: true }).first().click();
  // l'indicatore di sviluppo di Next non deve finire nelle immagini se l'app gira con `next dev`
  await page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}" });
  for (const [label, value] of screen.fill ?? []) await page.getByLabel(tr(label), { exact: true }).first().fill(value);
  await page.waitForTimeout(SETTLE_MS);
}

/** Contesto del browser con la sessione demo, il tema scelto e il tour di Categorizza già visto (si cattura la schermata, non la guida sopra). */
async function demoContext(theme, options) {
  const context = await browser.newContext({ colorScheme: theme, locale: BROWSER_LOCALES[LANGUAGE], ...options });
  await context.addCookies([{ name: "better-auth.session_token", value: cookieValue, domain: host, path: "/" }]);
  await context.addInitScript((t) => {
    localStorage.setItem("theme", t);
    localStorage.setItem("bb:categorize-tour-seen", "1");
  }, theme);
  return context;
}

for (const theme of SCREEN_THEMES) {
  const context = await demoContext(theme, { viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  mkdirSync(screensDir(theme), { recursive: true });
  for (const screen of PHONE_ONLY ? [] : selected) {
    await openScreen(page, screen);
    // L'app scorre dentro <main>: si allunga la finestra fino all'altezza del contenuto (con un tetto), poi si scatta.
    const contentHeight = await page.evaluate(() => document.querySelector("main")?.scrollHeight ?? 0);
    const height = referenceHeight(screen.id, theme) ?? Math.min(screen.maxHeight ?? MAX_HEIGHT, Math.max(VIEWPORT.height, contentHeight));
    await page.setViewportSize({ width: VIEWPORT.width, height });
    if (screen.scrollToText) await page.getByText(tr(screen.scrollToText)).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(SETTLE_MS / 3);
    const file = join(screensDir(theme), `${screen.id}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: JPEG_QUALITY });
    // Versione leggera a 1x (1280 px di larghezza) per i telefoni: un terzo dei pixel da decodificare.
    await page.screenshot({ path: join(screensDir(theme), `${screen.id}-sm.jpg`), type: "jpeg", quality: JPEG_QUALITY, scale: "css" });
    // Versione con solo la parte alta, per i riquadri a proporzione fissa (l'apertura della home).
    if (screen.topCrop) {
      const top = join(screensDir(theme), `${screen.id}-top.jpg`);
      await page.screenshot({ path: top, type: "jpeg", quality: JPEG_QUALITY, clip: { x: 0, y: 0, ...VIEWPORT } });
    }
    await page.setViewportSize(VIEWPORT);
    manifest.screens.push({ id: screen.id, theme, route: screen.route, width: Math.round(VIEWPORT.width * SCALE), height: Math.round(height * SCALE), phone: Boolean(screen.phone) });
    console.log(`${LANGUAGE}/${theme}/${screen.id}`);
  }
  await context.close();

  // Versione da telefono: solo il primo schermo, come lo vede chi apre l'app dal browser del telefono.
  const phoneScreens = selected.filter((screen) => screen.phone);
  if (phoneScreens.length > 0) {
    const phoneContext = await demoContext(theme, { viewport: PHONE, deviceScaleFactor: PHONE_SCALE, isMobile: true, hasTouch: true });
    const phonePage = await phoneContext.newPage();
    for (const screen of phoneScreens) {
      await openScreen(phonePage, screen);
      await phonePage.screenshot({ path: join(screensDir(theme), `${screen.id}-phone.jpg`), type: "jpeg", quality: JPEG_QUALITY });
      console.log(`${LANGUAGE}/${theme}/${screen.id}-phone`);
    }
    await phoneContext.close();
  }
}
await browser.close();
if (PHONE_ONLY) {
  // Full-size dimensions stay those of the previous capture; only the `phone` flag changes.
  const previous = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.screens = previous.screens.map((entry) => (selected.some((screen) => screen.id === entry.id) ? { ...entry, phone: Boolean(SCREENS.find((screen) => screen.id === entry.id)?.phone) } : entry));
  manifest.capturedAt = previous.capturedAt;
} else if (ONLY) {
  const previous = JSON.parse(readFileSync(manifestPath, "utf8"));
  const kept = previous.screens.filter((entry) => !ONLY.includes(entry.id));
  manifest.screens = [...kept, ...manifest.screens];
  manifest.capturedAt = previous.capturedAt;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
