import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { paths } from '@/lib/paths.jsx';

// Define public paths (accessible without a session or when session exists but path is inherently public)
const publicPathPatterns = [
  paths.login,
  paths.register,
  paths.forgotPassword,
  paths.resetPassword,
  '/verify', // Base path for verification routes (e.g., /verify?token=...)
];

// Define whitelisted paths (always accessible, bypasses most session/auth checks)
const whitelistedPaths = [
  paths.privacy,
  paths.terms,
  paths.support,
];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 1. Root path: always redirect to login
  if (pathname === paths.root) {
    return NextResponse.redirect(new URL(paths.login, req.url));
  }

  // 2. Whitelisted paths: always allow
  if (whitelistedPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // 3. Check if the current path is a public path
  const isPublic = publicPathPatterns.some(pattern => 
    // Exact match for defined paths like paths.login, startsWith for patterns like '/verify'
    (typeof pattern === 'string' && pattern.startsWith('/') ? pathname.startsWith(pattern) : pathname === pattern)
  );

  // If it's a public path:
  // - If no token, allow access (e.g., viewing login page when not logged in).
  // - If token exists, also allow (e.g., logged-in user revisiting login page - page itself might redirect).
  if (isPublic) {
    return NextResponse.next();
  }

  // 4. No token (and not public/whitelisted): redirect to login
  // This implies the path is protected and requires authentication.
  if (!token) { // isPublic and whitelisted are false by this point
    return NextResponse.redirect(new URL(paths.login, req.url));
  }

  // 5. Token exists (user is authenticated): proceed with checks for authenticated users
  // The `token.isValid` check is intentionally omitted here, as middleware cannot securely
  // call signOut(). That specific check will remain in a simplified client-side SessionGuard.
  if (token) {
    // Onboarding logic:
    // If user has not completed onboarding...
    if (!token.hasCompletedOnboarding) {
      // ...and is not already on the onboarding page...
      // (no need to check for isPublic here again, as public paths for authenticated users are allowed by rule #3)
      if (pathname !== paths.onboarding) {
        return NextResponse.redirect(new URL(paths.onboarding, req.url));
      }
    } else { // User HAS completed onboarding
      // If they are trying to access the onboarding page, redirect to dashboard
      if (pathname === paths.onboarding) {
        return NextResponse.redirect(new URL(paths.dashboard, req.url));
      }
    }
  }
  
  // All other cases (e.g., authenticated, onboarded user accessing a protected page): allow the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/ (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - Any path that looks like a file with an extension (e.g., .png, .jpg, .svg, .ico, .js, .css)
     * This allows the middleware to focus on page routes.
     */
    '/((?!api/|_next/static|_next/image|.*\.[^.]+$).*)', // Excludes paths with extensions
    '/', // Explicitly match the root path
  ],
}; 