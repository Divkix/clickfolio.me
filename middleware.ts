import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AB_COOKIE_MAX_AGE, AB_COOKIE_NAME, type ABVariant } from "@/lib/ab-testing/constants";

// Protected routes that require authentication
const protectedRoutes = ["/dashboard", "/edit", "/settings", "/waiting", "/wizard"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Start with a response we can modify (for setting cookies)
  let response: NextResponse;

  // Check if current path starts with any protected route
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Check for Better Auth session cookie
    // Better Auth uses "better-auth.session_token" as the default cookie name
    const sessionCookie = request.cookies.get("better-auth.session_token");

    if (!sessionCookie) {
      // No session, redirect to home
      response = NextResponse.redirect(new URL("/", request.url));
    } else {
      // Session cookie exists, allow access
      // Note: Onboarding completion check is now handled in page components
      // since we cannot make DB calls from Edge middleware
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  // A/B Test Cookie Assignment
  // Assign the cookie if not set or if the value is invalid
  const existingABCookie = request.cookies.get(AB_COOKIE_NAME);
  const existingValue = existingABCookie?.value;

  if (existingValue !== "A" && existingValue !== "B") {
    // 50/50 split: assign variant randomly
    const variant: ABVariant = Math.random() < 0.5 ? "A" : "B";

    response.cookies.set(AB_COOKIE_NAME, variant, {
      maxAge: AB_COOKIE_MAX_AGE,
      httpOnly: false, // Allow client-side JS to read
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
