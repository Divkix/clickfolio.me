import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Protected routes that require authentication
const protectedRoutes = ["/dashboard", "/edit", "/settings", "/waiting", "/wizard"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if current path starts with any protected route
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookie
  // Better Auth uses "better-auth.session_token" as the default cookie name
  const sessionCookie = request.cookies.get("better-auth.session_token");

  if (!sessionCookie) {
    // No session, redirect to home
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Session cookie exists, allow access
  // Note: Onboarding completion check is now handled in page components
  // since we cannot make DB calls from Edge middleware
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
