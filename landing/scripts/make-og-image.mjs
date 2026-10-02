// Genera public/og.png (1200×630) per le anteprime social: marchio, titolo e uno screenshot dell'app.
// Uso: node scripts/make-og-image.mjs  (PLAYWRIGHT_MODULE / CHROMIUM_PATH come in capture-screens.mjs)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const shot = readFileSync(join(root, "public/screens/dark/panoramica.jpg")).toString("base64");

const html = `<html><body style="margin:0;width:1200px;height:630px;background:#0b0b0d;color:#f4f4f5;font-family:system-ui,sans-serif;position:relative;overflow:hidden">
<div style="position:absolute;inset:-20% 30% auto -10%;height:70%;background:radial-gradient(closest-side,rgba(33,158,188,.35),transparent)"></div>
<div style="position:absolute;left:72px;top:84px;width:520px">
<div style="font-size:30px;font-weight:700;letter-spacing:-.02em;color:#219ebc">BuddyBudget</div>
<div style="font-size:60px;line-height:1.04;font-weight:700;letter-spacing:-.04em;margin-top:28px">Budget, investimenti, pensione e debiti in un solo quadro.</div>
<div style="font-size:24px;color:#a1a1aa;margin-top:28px">Con le tasse italiane già calcolate.</div></div>
<img src="data:image/jpeg;base64,${shot}" style="position:absolute;left:640px;top:150px;width:760px;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);border:1px solid #333"/>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
writeFileSync(join(root, "public/og.png"), await page.screenshot({ type: "png" }));
await browser.close();
