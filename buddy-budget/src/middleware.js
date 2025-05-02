import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { paths } from "@/lib/paths"

export default withAuth(
  // `withAuth` enhances the `Request` object with the user's token.
  function middleware(req) {
    const { token } = req.nextauth
    const { pathname } = req.nextUrl

    // Check if user is authenticated (token exists and is valid - handled by withAuth and JWT callback)
    if (!token) {
      // Should not happen often as withAuth handles redirection by default,
      // but as a safeguard.
      return NextResponse.redirect(new URL(paths.login, req.url))
    }

    const isOnboardingPage = pathname.startsWith(paths.onboarding)
    const isApiAuthRoute = pathname.startsWith('/api/auth')
    const isOnboardingApiRoute = pathname.startsWith('/api/onboarding') // Assuming an API route for onboarding exists or will exist

    // If user has not completed onboarding
    if (!token.hasCompletedOnboarding) {
      // Allow access only to onboarding page and specific API routes
      if (!isOnboardingPage && !isApiAuthRoute && !isOnboardingApiRoute) {
        return NextResponse.redirect(new URL(paths.onboarding, req.url))
      }
    }
    // If user HAS completed onboarding but tries to access the onboarding page
    else if (token.hasCompletedOnboarding && isOnboardingPage) {
      // Redirect them to the dashboard
      return NextResponse.redirect(new URL(paths.dashboard, req.url))
    }

    // Allow the request to proceed if none of the above conditions are met
    return NextResponse.next()
  },
  {
    callbacks: {
      // This authorized callback determines if the user is allowed to access the page
      // It runs BEFORE the middleware function above.
      // We return true here because we handle the logic inside the main middleware function.
      // The presence of a valid token is the basic authorization check handled by withAuth.
      authorized: ({ token }) => !!token,
    },
    pages: {
      // Redirect users to this page if they are not authorized (no token)
      signIn: paths.login,
      error: paths.login, // Optional: Handle auth errors
    },
  }
)

// Matcher configuration: Specify which paths the middleware should apply to.
export const config = {
  matcher: [
    // Apply middleware to all routes except static files, _next internal files, and API auth routes.
    // Exclude favicon.ico and image assets as well.
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).)*',
    // Include specific API routes if needed, e.g., '/api/protected-route'
    // Exclude onboarding API if it needs to be public before onboarding
    // '/api/(?!onboarding).*', // Example: exclude /api/onboarding
  ],
} 