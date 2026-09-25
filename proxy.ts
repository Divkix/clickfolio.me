import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CLAIM_HANDLE_PATH,
  LANDING_VARIANT_COOKIE,
  LANDING_VARIANT_COOKIE_MAX_AGE,
  LANDING_VARIANT_OVERRIDE_PARAM,
  decideLandingVariant,
} from "@/lib/experiments/landing";

const protectedRoutes = ["/dashboard", "/edit", "/settings", "/waiting", "/wizard"];

// Landing A/B test (ADR-0027): sticky cookie bucket; `claim_handle` is a
// rewrite so the browser URL stays `/` and each variant keeps its ISR cache.
function landingExperiment(request: NextRequest): NextResponse {
  const { variant, stamp } = decideLandingVariant({
    override: request.nextUrl.searchParams.get(LANDING_VARIANT_OVERRIDE_PARAM),
    cookie: request.cookies.get(LANDING_VARIANT_COOKIE)?.value,
    roll: Math.random(),
  });

  let response = NextResponse.next();

  if (variant === "claim_handle") {
    const target = request.nextUrl.clone();
    target.pathname = CLAIM_HANDLE_PATH;
    response = NextResponse.rewrite(target);
  }

  if (stamp) {
    response.cookies.set(LANDING_VARIANT_COOKIE, variant, {
      path: "/",
      maxAge: LANDING_VARIANT_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }

  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return landingExperiment(request);
  }

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check for the Clerk session cookie. Clerk only sets `__session` once a
  // user has an active session; the `__client` device cookie exists even when
  // signed out, so it must never grant access to protected routes.
  const hasSessionCookie = request.cookies.has("__session");

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
