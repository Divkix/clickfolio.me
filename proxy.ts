import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** @const Protected routes that require authentication. */
const protectedRoutes = ["/dashboard", "/edit", "/settings", "/waiting", "/wizard"];

/**
 * Middleware proxy that enforces authentication on protected routes.
 *
 * Checks the request pathname against `protectedRoutes` and validates the
 * presence of a Clerk `__session` cookie. If no session is found, the user is
 * redirected to the home page.
 *
 * **Note:** This proxy cannot access D1, so onboarding completion checks are
 * deferred to the page components. Cryptographic JWT verification (JWKS) also
 * does NOT happen here — it runs once per request in the route handlers /
 * RSC helpers (`requireAuthClerk`, `getServerSession`), which keeps this edge
 * gate cheap. A present-but-invalid `__session` therefore passes the proxy and
 * is rejected with 401/redirect by the page-level auth checks.
 *
 * @param request - The incoming Next.js request.
 * @returns A `NextResponse` allowing or blocking the request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if current path starts with any protected route
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for the Clerk session cookie. Clerk only sets `__session` once a
  // user has an active session; the `__client` device cookie exists even when
  // signed out, so it must never grant access to protected routes.
  const hasSessionCookie = request.cookies.has("__session");

  if (!hasSessionCookie) {
    // No session, redirect to home
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Session cookie exists, allow access
  // Note: Onboarding completion check is now handled in page components
  // since this proxy layer cannot make DB calls
  return NextResponse.next();
}

export default proxy;

/**
 * Next.js middleware matcher configuration.
 *
 * Matches all paths except Next.js static assets, images, and common static file extensions.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
