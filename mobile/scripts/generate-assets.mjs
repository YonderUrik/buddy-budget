// Generates the app icons and splash screens of the iOS and Android projects from the brand mark
// (`../public/brand/logo-mark.svg`). Run after changing the mark: `pnpm assets`, then commit the generated files.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MARK = path.join(root, "..", "public", "brand", "logo-mark.svg");
/** Background of icons and splash: the white of the web app's icon (`public/icons/icon-512.png`). */
const BACKGROUND = "#ffffff";

/** Square PNG: the mark centred on the background, its height `markRatio` of the side. */
async function squareImage(size, markRatio, background = BACKGROUND) {
  const markHeight = Math.round(size * markRatio);
  const mark = await sharp(MARK, { density: 600 }).resize({ height: markHeight }).png().toBuffer();
  const canvas = sharp({ create: { width: size, height: size, channels: 4, background } });
  return canvas.composite([{ input: mark, gravity: "center" }]).png().toBuffer();
}

async function write(relativePath, buffer) {
  const file = path.join(root, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
}

// iOS: one 1024 icon (no transparency, as App Store requires) and the 2732 splash in its three slots.
const iosIcon = await sharp(await squareImage(1024, 0.62)).flatten({ background: BACKGROUND }).removeAlpha().png().toBuffer();
await write("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", iosIcon);
const iosSplash = await squareImage(2732, 0.16);
for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await write(`ios/App/App/Assets.xcassets/Splash.imageset/${name}`, iosSplash);
}

// Android: legacy and round launcher icons, adaptive foreground (mark inside the 66% safe zone) on a white layer.
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(densities)) {
  const legacy = Math.round(48 * scale);
  const icon = await squareImage(legacy, 0.62);
  await write(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`, icon);
  const roundMask = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
  await write(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`, await sharp(icon).composite([{ input: roundMask, blend: "dest-in" }]).png().toBuffer());
  const foreground = Math.round(108 * scale);
  await write(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`, await squareImage(foreground, 0.42, "#ffffff00"));
}
await write(
  "android/app/src/main/res/values/ic_launcher_background.xml",
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BACKGROUND.toUpperCase()}</color>\n</resources>\n`
);

// Android splash (legacy drawable, shown before Android 12's system splash takes the launcher icon).
const portrait = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
async function splash(width, height) {
  const markHeight = Math.round(Math.min(width, height) * 0.22);
  const mark = await sharp(MARK, { density: 600 }).resize({ height: markHeight }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: BACKGROUND } }).composite([{ input: mark, gravity: "center" }]).png().toBuffer();
}
await write("android/app/src/main/res/drawable/splash.png", await splash(480, 320));
for (const [density, [width, height]] of Object.entries(portrait)) {
  await write(`android/app/src/main/res/drawable-port-${density}/splash.png`, await splash(width, height));
  await write(`android/app/src/main/res/drawable-land-${density}/splash.png`, await splash(height, width));
}

console.log("Icons and splash screens generated.");
