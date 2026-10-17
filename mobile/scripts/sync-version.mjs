// Copies the app release (`package.json` version, bumped by release-please) into the iOS project: MARKETING_VERSION is
// the version shown in the App Store, CURRENT_PROJECT_VERSION the build number (same formula as Android's versionCode).
// Android reads package.json directly in `android/app/build.gradle`. Runs before `cap sync` (`pnpm sync`).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const [major, minor, patch] = version.split(".").map((part) => Number.parseInt(part, 10));
const build = major * 1_000_000 + minor * 1_000 + patch;

const project = path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
const source = await readFile(project, "utf8");
const updated = source
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
if (updated !== source) await writeFile(project, updated);
console.log(`iOS version ${version} (${build}).`);
