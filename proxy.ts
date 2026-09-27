import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/auth/constants";

// /api/health* sono le probe di liveness/readiness; /api/cron/* è protetto dal segreto CRON_SECRET, non dalla sessione.
const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth", "/api/health", "/api/cron", "/api/metrics", "/_next", "/favicon.ico"];

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

  const { onboardingCompleted } = session.user;

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
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.webmanifest|icons/|brand/).*)",
  ],
};
