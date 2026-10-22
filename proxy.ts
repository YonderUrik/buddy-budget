import { COUNTRY_UNAVAILABLE_MESSAGE, LANGUAGES, LANGUAGE_COOKIE, isCountryPathAvailable, resolveProfile } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/auth/constants";
import { ACCOUNT_DEACTIVATED_CODE, LEGAL_ACCEPTANCE_REQUIRED_CODE, ONBOARDING_REQUIRED_CODE, accountGate, accountGateErrorBody } from "@/lib/account/gates";
import { logger, recordPlanBlock, recordPublicDemoEvent } from "@/lib/observability";
import { PLAN_REQUIRED_CODE, PRO_PAGE_PATH, isPlanPathAvailable, proAreaOf } from "@/lib/billing";
import { planForUser } from "@/lib/billing/plan-for-user";
import { PUBLIC_DEMO_READ_ONLY_CODE, PUBLIC_DEMO_READ_ONLY_MESSAGE, isPublicDemoUserId, isReadOnlyMethod, publicDemoSessionProfile } from "@/lib/public-demo/config";

// /api/health* sono le probe di liveness/readiness; /api/cron/* è protetto dal segreto CRON_SECRET, non dalla sessione.
// /demo opens the read-only public demo (it decides itself whether a session exists).
// /api/legal serves the current legal version and document links, needed before sign-in and while legal-gated.
// /api/gocardless/callback/native and /banca/ritorno hand the system browser back to the native app after bank consent:
// that browser has no session, and neither touches any state (the app completes the link with its bearer token).
// /reimposta-password receives the emailed password reset link (the token in the address is the authorisation).
// /api/stripe/webhook is called by Stripe and authenticated by its signature.
const PUBLIC_PATH_PREFIXES = ["/login", "/reimposta-password", "/demo", "/api/auth", "/api/health", "/api/legal", "/api/meta", "/api/cron", "/api/metrics", "/api/email", "/api/stripe/webhook", "/api/gocardless/callback/native", "/banca/ritorno", "/disiscrizione", "/_next", "/favicon.ico"];

/** Unica pagina accessibile a un account disattivato. */
const DEACTIVATED_PAGE_PATH = "/account-disattivato";
/** Unica API accessibile a un account disattivato. */
const REACTIVATE_API_PATH = "/api/user/reactivate";

/** Pagina dove chi ha già un account accetta la versione in vigore di Termini e Privacy. */
const LEGAL_ACCEPTANCE_PAGE_PATH = "/accetta-termini";
/** API ancora accessibili senza aver accettato: l'accettazione stessa, l'export dei dati e l'eliminazione dell'account. */
const LEGAL_GATE_ALLOWED_API_PATHS = ["/api/user/legal-acceptance", "/api/user/export", "/api/user/account"];
/** APIs open through every account gate: the native apps read them to decide which gate screen to show. */
const GATE_EXEMPT_API_PATHS = ["/api/me/bootstrap"];

/** True se il percorso è accessibile senza sessione (confronto per segmento: `/api/health` sì, `/api/healthz` no). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Absolute address of an app page for a redirect. Behind the ingress `request.url` carries the container's bind
 * address (`0.0.0.0:3000`), so the public `APP_URL` wins; without it (tests, local dev) the request URL is used.
 */
function appUrl(request: NextRequest, path: string): URL {
  const base = process.env.APP_URL?.replace(/\/+$/, "");
  return new URL(path, base ? `${base}/` : request.url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Chi è già autenticato non deve rivedere il form di login.
  if (pathname === "/login") {
    const existing = await auth.api.getSession({ headers: request.headers });
    if (existing) {
      const target = safeRedirectPath(request.nextUrl.searchParams.get("redirect"));
      return NextResponse.redirect(appUrl(request, target));
    }
    // `?lang=` from the landing (a language the visitor picked there) becomes the page's language choice.
    const chosen = LANGUAGES.find((language) => language === request.nextUrl.searchParams.get("lang"));
    if (chosen) {
      const clean = appUrl(request, pathname);
      request.nextUrl.searchParams.forEach((value, key) => {
        if (key !== "lang") clean.searchParams.append(key, value);
      });
      const response = NextResponse.redirect(clean);
      response.cookies.set(LANGUAGE_COOKIE, chosen, { path: "/", maxAge: 31536000, sameSite: "lax", secure: clean.protocol === "https:" });
      return response;
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(null, { status: 401 });
    }
    const loginUrl = appUrl(request, "/login");
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const gate = accountGate(session.user);

  // Public demo: a shared sample account, so its sessions can read everything and write nothing.
  if (isPublicDemoUserId(session.user.id) && pathname.startsWith("/api/") && !isReadOnlyMethod(request.method)) {
    const { language, productCountry } = publicDemoSessionProfile(session.user);
    recordPublicDemoEvent("write_blocked", language, productCountry);
    return NextResponse.json({ code: PUBLIC_DEMO_READ_ONLY_CODE, error: translate(language, PUBLIC_DEMO_READ_ONLY_MESSAGE) }, { status: 403 });
  }

  // Deactivated account: until it is reactivated only its own page is shown; APIs answer a coded 403, except
  // reactivation, the bootstrap read (and /api/auth, public, to sign out).
  if (gate === ACCOUNT_DEACTIVATED_CODE) {
    if (pathname.startsWith("/api/")) {
      return pathname === REACTIVATE_API_PATH || GATE_EXEMPT_API_PATHS.includes(pathname)
        ? NextResponse.next()
        : NextResponse.json(accountGateErrorBody(gate), { status: 403 });
    }
    return pathname === DEACTIVATED_PAGE_PATH
      ? NextResponse.next()
      : NextResponse.redirect(appUrl(request, DEACTIVATED_PAGE_PATH));
  }
  if (pathname === DEACTIVATED_PAGE_PATH) {
    return NextResponse.redirect(appUrl(request, "/"));
  }

  // Existing accounts must accept the current version of the legal documents (new version or older users).
  // Users who have not finished onboarding accept them there. Self-hosted installs skip it (see accountGate).
  if (gate === LEGAL_ACCEPTANCE_REQUIRED_CODE) {
    if (pathname.startsWith("/api/")) {
      return LEGAL_GATE_ALLOWED_API_PATHS.includes(pathname) || GATE_EXEMPT_API_PATHS.includes(pathname)
        ? NextResponse.next()
        : NextResponse.json(accountGateErrorBody(gate), { status: 403 });
    }
    return pathname === LEGAL_ACCEPTANCE_PAGE_PATH ? NextResponse.next() : NextResponse.redirect(appUrl(request, LEGAL_ACCEPTANCE_PAGE_PATH));
  }
  if (pathname === LEGAL_ACCEPTANCE_PAGE_PATH) {
    return NextResponse.redirect(appUrl(request, "/"));
  }

  if (gate === ONBOARDING_REQUIRED_CODE && pathname !== "/onboarding" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(appUrl(request, "/onboarding"));
  }

  if (gate !== ONBOARDING_REQUIRED_CODE && pathname === "/onboarding") {
    return NextResponse.redirect(appUrl(request, "/"));
  }

  const profile = resolveProfile(session.user);
  if (!isCountryPathAvailable(profile.productCountry, pathname)) {
    logger.info("country.feature.blocked", { country: profile.productCountry });
    if (pathname.startsWith("/api/")) return NextResponse.json({ code: "country_feature_unavailable", error: translate(profile.language, COUNTRY_UNAVAILABLE_MESSAGE) }, { status: 403 });
    return NextResponse.redirect(appUrl(request, "/country-unavailable"));
  }

  // Free plan (where billing applies): Liquidità stays open, the Pro areas lead to the plans page. After the country
  // check on purpose: a screen hidden in a country is never offered as Pro.
  if (!isPlanPathAvailable(planForUser(session.user).tier, pathname)) {
    const area = proAreaOf(pathname);
    logger.info("billing.plan.blocked", { proArea: area ?? "api" });
    if (pathname.startsWith("/api/")) {
      recordPlanBlock("api", "api");
      return NextResponse.json({ code: PLAN_REQUIRED_CODE, error: translate(profile.language, "Questa funzione fa parte di BuddyBudget Pro.") }, { status: 402 });
    }
    recordPlanBlock(area ?? "other", "page");
    const target = appUrl(request, PRO_PAGE_PATH);
    if (area) target.searchParams.set("da", area);
    return NextResponse.redirect(target);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.webmanifest|icons/|brand/|instrument-icons/).*)",
  ],
};
