import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Date of the last change to each page's content (`YYYY-MM-DD` by route), written by `scripts/page-dates.mjs` from the
 * git history before the build. Empty when the build has no history (a shallow clone): pages then go without a date
 * rather than with the build date. Server-only (reads the file at build time).
 */
function load(): Record<string, string> {
  const file = join(process.cwd(), "page-dates.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

const DATES = load();

/** Last content change of the page at `path`, or `undefined` when unknown. */
export function pageModified(path: string): string | undefined {
  return DATES[path];
}
