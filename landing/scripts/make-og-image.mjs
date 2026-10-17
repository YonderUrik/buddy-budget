// Generates public/og.png (1200×630) for social previews: brand, the home's promise and a screenshot of the app on the navy of the closing.
// Usage: node scripts/make-og-image.mjs  (PLAYWRIGHT_MODULE / CHROMIUM_PATH as in capture-screens.mjs)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const shot = readFileSync(join(root, "public/screens/dark/panoramica.jpg")).toString("base64");

const html = `<html><body style="margin:0;width:1200px;height:630px;background:#0b1c2a;color:#f4f6f7;font-family:system-ui,sans-serif;position:relative;overflow:hidden">
<div style="position:absolute;left:72px;top:84px;width:540px">
<div style="font-size:30px;font-weight:700;letter-spacing:-.02em;color:#46b8d4">BuddyBudget</div>
<div style="font-size:64px;line-height:1.02;font-weight:700;letter-spacing:-.04em;margin-top:28px">Tutti i tuoi soldi, in un numero solo.</div>
<div style="font-size:24px;line-height:1.35;color:#a1a1aa;margin-top:28px">Conto, investimenti, pensione e mutuo insieme. Tasse italiane comprese.</div></div>
<img src="data:image/jpeg;base64,${shot}" style="position:absolute;left:660px;top:150px;width:760px;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);border:1px solid #1f3f56"/>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
writeFileSync(join(root, "public/og.png"), await page.screenshot({ type: "png" }));
await browser.close();
