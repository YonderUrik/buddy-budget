import { NATIVE_URL_SCHEME } from "@/lib/native/deep-link";
import { GOCARDLESS_CALLBACK_PATH } from "./redirect";

/** Texts of the hand-over page, already translated by the caller. */
export interface AppReturnTexts {
  title: string;
  body: string;
  button: string;
}

/**
 * Link that reopens the phone app on the bank callback, carrying every query parameter the bank sent back (`ref`,
 * `error`…). The app's WebView holds the session cookie, so the callback must run there, not in the system browser.
 */
export function appReturnDeepLink(search: URLSearchParams): string {
  const query = search.toString();
  const path = `${GOCARDLESS_CALLBACK_PATH}${query ? `?${query}` : ""}`;
  return `${NATIVE_URL_SCHEME}://open?path=${encodeURIComponent(path)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Small page shown in the in-app browser after the bank: it opens the app at once and keeps a button as a fallback. */
export function appReturnPage(deepLink: string, texts: AppReturnTexts, language: string): string {
  const href = escapeHtml(deepLink);
  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(texts.title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #ffffff; --fg: #0f1b3d; --muted: #5b6478; --accent: #0f1b3d; --accent-fg: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b1020; --fg: #f4f6fb; --muted: #a3abc0; --accent: #f4f6fb; --accent-fg: #0b1020; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width: 22rem; padding: 2rem 1.5rem; text-align: center; }
  h1 { font-size: 1.375rem; margin: 0 0 .5rem; }
  p { color: var(--muted); margin: 0 0 1.5rem; }
  a { display: inline-block; padding: .875rem 1.5rem; border-radius: .75rem; background: var(--accent); color: var(--accent-fg); text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(texts.title)}</h1>
<p>${escapeHtml(texts.body)}</p>
<a id="open" href="${href}">${escapeHtml(texts.button)}</a>
</main>
<script>location.replace(document.getElementById("open").getAttribute("href"));</script>
</body>
</html>`;
}
