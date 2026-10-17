import { NextRequest } from "next/server";
import { appReturnDeepLink, appReturnPage } from "@/lib/gocardless/app-return";
import { getLocaleProfile } from "@/lib/localization/server";
import { translate } from "@/lib/localization/messages";
import { requestLogger, withRoute } from "@/lib/observability";

/**
 * Return page of the bank consent started from the phone app. The bank lands here in the in-app browser, which has no
 * session: the page reopens the app (`buddybudget://`) on the real callback, which then runs in the app's WebView.
 * Public on purpose (no data, no state change); the callback still checks the session and the connection's owner.
 */
async function handleGet(request: NextRequest) {
  const { language } = await getLocaleProfile();
  const tr = (source: string) => translate(language, source);
  requestLogger().info("gocardless.app_return.served", { outcome: request.nextUrl.searchParams.has("error") ? "error" : "success" });
  const html = appReturnPage(
    appReturnDeepLink(request.nextUrl.searchParams),
    {
      title: tr("Torna in BuddyBudget"),
      body: tr("La banca ha finito. Torna nell'app per vedere i conti collegati."),
      button: tr("Apri BuddyBudget"),
    },
    language
  );
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export const GET = withRoute("gocardless.app_return", handleGet);
