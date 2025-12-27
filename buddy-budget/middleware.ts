import { NextResponse } from "next/server";

import { auth, OnboardingStep } from "@/lib/auth";

// Define public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/privacy",
  "/terms",
  "/finance",
  "/net-worth",
  "/signin",
  "/api/auth",
];

// Map onboarding steps to routes
const ONBOARDING_STEP_ROUTES: Record<OnboardingStep, string> = {
  [OnboardingStep.NOT_STARTED]: "/onboarding/welcome",
  [OnboardingStep.WELCOME]: "/onboarding/welcome",
  [OnboardingStep.USER_PROFILE]: "/onboarding/user-profile",
  [OnboardingStep.FINANCIAL_GOALS]: "/onboarding/financial-goals",
  [OnboardingStep.INITIAL_NET_WORTH]: "/onboarding/initial-net-worth",
  [OnboardingStep.PREFERENCES]: "/onboarding/preferences",
  [OnboardingStep.COMPLETED]: "/dashboard",
};

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === pathname) return true;
    if (route.includes("*")) {
      const baseRoute = route.replace("/*", "");

      return pathname.startsWith(baseRoute);
    }
    if (pathname.startsWith("/api/auth")) return true; // NextAuth API routes

    return false;
  });
}

function isProtectedRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard");
}

function isOnboardingRoute(pathname: string): boolean {
  return pathname.startsWith("/onboarding");
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to sign-in
  if (!session?.user) {
    if (isProtectedRoute(pathname) || isOnboardingRoute(pathname)) {
      const signInUrl = new URL("/signin", req.url);

      signInUrl.searchParams.set("callbackUrl", pathname);

      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  }

  // User is authenticated - check onboarding status
  const { onboardingCompleted, onboardingStep } = session.user;

  // If user hasn't completed onboarding
  if (!onboardingCompleted) {
    // If trying to access protected routes, redirect to appropriate onboarding step
    if (isProtectedRoute(pathname)) {
      const onboardingUrl = new URL(
        ONBOARDING_STEP_ROUTES[onboardingStep],
        req.url,
      );

      return NextResponse.redirect(onboardingUrl);
    }

    // If on wrong onboarding step, redirect to correct one
    if (isOnboardingRoute(pathname)) {
      const currentStepRoute = ONBOARDING_STEP_ROUTES[onboardingStep];

      if (pathname !== currentStepRoute) {
        return NextResponse.redirect(new URL(currentStepRoute, req.url));
      }
    }

    return NextResponse.next();
  }

  // User has completed onboarding
  // If trying to access onboarding routes, redirect to dashboard
  if (isOnboardingRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Allow access to all other routes
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
