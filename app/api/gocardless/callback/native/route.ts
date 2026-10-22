import { NextRequest } from "next/server";
import { nativeReturnUrl, parseNativeReturn } from "@/lib/gocardless/redirect";
import { requestLogger, withRoute } from "@/lib/observability";

/**
 * Return target of the requisitions started by the native apps (`client: "native"` on `POST /api/gocardless/connections`).
 * Public (no session: the system browser that completes the consent has no cookie) and side-effect free: it never reads
 * the database nor GoCardless, it only hands the browser back to the app with `buddybudget://bank/return?ref&status`.
 * The app then calls the authenticated `POST /api/gocardless/connections/{ref}/complete`, which checks ownership and the
 * real requisition state, so a forged address can at most open the app on a screen that finds nothing to complete.
 */
async function handleGet(request: NextRequest) {
  const outcome = parseNativeReturn(request.nextUrl.searchParams);
  // The ref arrives from the browser (untrusted): logged only as an outcome, never echoed.
  requestLogger().info("gocardless.callback.native_returned", { outcome: outcome.status, reason: outcome.error ?? undefined });
  return new Response(null, {
    status: 302,
    headers: { location: nativeReturnUrl(outcome), "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

export const GET = withRoute("gocardless.callback.native", handleGet);
