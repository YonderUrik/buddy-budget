import { getAppUrl } from "@/lib/env";

/** Where the person started the bank consent: the web app, or the phone app (which must get the result back in its WebView). */
export type GoCardlessRedirectClient = "web" | "app";

/** Public page that hands the bank's return over to the phone app (`buddybudget://`), see `app/api/gocardless/app-return`. */
export const GOCARDLESS_APP_RETURN_PATH = "/api/gocardless/app-return";
export const GOCARDLESS_CALLBACK_PATH = "/api/gocardless/callback";

/** URL a cui GoCardless rimanda dopo il consenso. Salvato su ogni requisition: la pulizia lo usa per riconoscere le nostre. */
export function gocardlessRedirectUrl(client: GoCardlessRedirectClient = "web"): string {
  return `${getAppUrl()}${client === "app" ? GOCARDLESS_APP_RETURN_PATH : GOCARDLESS_CALLBACK_PATH}`;
}

/** Every return URL this app gives GoCardless (web and phone app), to recognise our own requisitions. */
export function gocardlessOwnRedirectUrls(): string[] {
  return [gocardlessRedirectUrl("web"), gocardlessRedirectUrl("app")];
}
