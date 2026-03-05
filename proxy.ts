import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Protected routes that require authentication
const protectedRoutes = ["/dashboard", "/edit", "/settings", "/waiting", "/wizard"];

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
  // since we cannot make DB calls from Edge middleware
  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
