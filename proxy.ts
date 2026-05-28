import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** @const Protected routes that require authentication. */
const protectedRoutes = ["/dashboard", "/edit", "/settings", "/waiting", "/wizard"];

/**
 * Middleware proxy that enforces authentication on protected routes.
 *
 * Checks the request pathname against `protectedRoutes` and validates the
 * presence of a Better Auth session cookie. If no session is found, the user
 * is redirected to the home page.
 *
 * **Note:** This proxy cannot access D1, so onboarding completion checks are
 * deferred to the page components.
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

  // Check for Better Auth session cookie
  // In production over HTTPS, Better Auth may prefix the cookie with "__Secure-"
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ??
    request.cookies.get("better-auth.session_token");

  if (!sessionCookie) {
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
