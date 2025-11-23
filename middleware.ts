import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  // Protected routes that require authentication
  const protectedRoutes = [
    "/dashboard",
    "/edit",
    "/settings",
    "/waiting",
    "/wizard",
  ];

  // Routes that don't require onboarding completion check
  const onboardingExemptRoutes = ["/wizard", "/auth/callback"];

  // Check if current path starts with any protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  // Redirect to home if accessing protected route without auth
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check onboarding completion for authenticated users on protected routes
  if (user && isProtectedRoute) {
    // Skip onboarding check for exempt routes
    const isExemptRoute = onboardingExemptRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route),
    );

    if (!isExemptRoute) {
      // Create supabase client to check onboarding status
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            setAll(cookiesToSet) {
              // No-op for middleware (cookies already set by updateSession)
            },
          },
        },
      );

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      // Redirect to wizard if onboarding not completed
      if (profile && !profile.onboarding_completed) {
        return NextResponse.redirect(new URL("/wizard", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
