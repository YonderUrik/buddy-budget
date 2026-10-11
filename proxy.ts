import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/auth/constants";
import { needsLegalAcceptance } from "@/lib/legal";

// /api/health* sono le probe di liveness/readiness; /api/cron/* è protetto dal segreto CRON_SECRET, non dalla sessione.
const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth", "/api/health", "/api/cron", "/api/metrics", "/api/email", "/disiscrizione", "/_next", "/favicon.ico"];

/** Unica pagina accessibile a un account disattivato. */
const DEACTIVATED_PAGE_PATH = "/account-disattivato";
/** Unica API accessibile a un account disattivato. */
const REACTIVATE_API_PATH = "/api/user/reactivate";

/** Pagina dove chi ha già un account accetta la versione in vigore di Termini e Privacy. */
const LEGAL_ACCEPTANCE_PAGE_PATH = "/accetta-termini";
/** API ancora accessibili senza aver accettato: l'accettazione stessa, l'export dei dati e l'eliminazione dell'account. */
const LEGAL_GATE_ALLOWED_API_PATHS = ["/api/user/legal-acceptance", "/api/user/export", "/api/user/account"];

/** True se il percorso è accessibile senza sessione (confronto per segmento: `/api/health` sì, `/api/healthz` no). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Chi è già autenticato non deve rivedere il form di login.
  if (pathname === "/login") {
    const existing = await auth.api.getSession({ headers: request.headers });
    if (existing) {
      const target = safeRedirectPath(request.nextUrl.searchParams.get("redirect"));
      return NextResponse.redirect(new URL(target, request.url));
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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { onboardingCompleted, deletionScheduledAt } = session.user;

  // Account disattivato: finché non viene riattivato si vede solo la pagina dedicata; le API rispondono 403,
  // tranne quella di riattivazione (e /api/auth, pubblica, per uscire).
  if (deletionScheduledAt) {
    if (pathname.startsWith("/api/")) {
      return pathname === REACTIVATE_API_PATH ? NextResponse.next() : new NextResponse(null, { status: 403 });
    }
    return pathname === DEACTIVATED_PAGE_PATH
      ? NextResponse.next()
      : NextResponse.redirect(new URL(DEACTIVATED_PAGE_PATH, request.url));
  }
  if (pathname === DEACTIVATED_PAGE_PATH) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Chi ha già un account deve accettare la versione in vigore dei documenti legali (nuova versione o utenti precedenti).
  // Chi non ha finito l'onboarding li accetta lì.
  if (onboardingCompleted && needsLegalAcceptance(session.user.legalAcceptedVersion)) {
    if (pathname.startsWith("/api/")) {
      return LEGAL_GATE_ALLOWED_API_PATHS.includes(pathname) ? NextResponse.next() : new NextResponse(null, { status: 403 });
    }
    return pathname === LEGAL_ACCEPTANCE_PAGE_PATH ? NextResponse.next() : NextResponse.redirect(new URL(LEGAL_ACCEPTANCE_PAGE_PATH, request.url));
  }
  if (pathname === LEGAL_ACCEPTANCE_PAGE_PATH) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!onboardingCompleted && pathname !== "/onboarding" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (onboardingCompleted && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.webmanifest|icons/|brand/|instrument-icons/).*)",
  ],
};
