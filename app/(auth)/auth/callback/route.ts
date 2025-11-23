import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createHash } from "crypto";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const type = requestUrl.searchParams.get("type"); // e.g., 'recovery' for password reset
  const origin = requestUrl.origin;

  // Handle OAuth errors (user cancelled, server error, etc.)
  if (error) {
    console.error("OAuth error received:", error, errorDescription);

    // Map error types to user-friendly redirects
    const errorMap: Record<string, string> = {
      access_denied: "cancelled",
      server_error: "server_error",
      invalid_request: "invalid_request",
    };

    const mappedError = errorMap[error] || "auth_failed";
    return NextResponse.redirect(`${origin}/login?error=${mappedError}`);
  }

  // Password reset flow - redirect to reset-password page
  // (Supabase should redirect directly there, but handle gracefully if we see it)
  if (type === "recovery") {
    console.log(
      "Password reset flow detected, redirecting to reset-password page",
    );
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  // All auth flows use PKCE code exchange
  if (!code) {
    console.error("No code parameter in callback URL");
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
    const supabase = await createClient();

    // Exchange code for session (works for OAuth, email confirmation, magic links)
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Error exchanging code for session:", exchangeError);

      // Handle specific token errors
      if (exchangeError.message?.includes("expired")) {
        return NextResponse.redirect(`${origin}/login?error=expired_token`);
      }
      if (exchangeError.message?.includes("invalid")) {
        return NextResponse.redirect(`${origin}/login?error=invalid_token`);
      }

      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Get user details
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      console.error("Error fetching user after code exchange:", userError);
      return NextResponse.redirect(`${origin}/login?error=user_fetch_failed`);
    }

    // Detect authentication flow type
    const provider = user.app_metadata?.provider || "email";
    const isOAuthFlow = provider === "google";
    const isEmailFlow = provider === "email";

    console.log(`Auth flow detected: ${provider} (user_id: ${user.id})`);

    // Handle avatar update for OAuth flows only
    if (isOAuthFlow && user.user_metadata?.avatar_url) {
      const { error: avatarError } = await supabase
        .from("profiles")
        .update({ avatar_url: user.user_metadata.avatar_url })
        .eq("id", user.id);

      if (avatarError) {
        console.error("Error updating profile avatar:", avatarError);
        // Non-critical error, continue flow
      } else {
        console.log(`Updated avatar for OAuth user ${user.id}`);
      }
    }

    // Security fix: Only check email confirmation for email/password signup flows
    // Magic links (signInWithOtp) authenticate users directly without confirmation
    // The key difference: after code exchange, magic link users will have email_confirmed_at set,
    // but signup confirmation users will also have it set. We need to distinguish by checking
    // if this is their first login (account just created) vs returning user.
    //
    // However, the simplest approach: if email_confirmed_at is set after code exchange,
    // the user is authenticated regardless of the method. If it's NOT set and provider is email,
    // then something went wrong with the confirmation flow.
    if (isEmailFlow && !user.email_confirmed_at) {
      // This should not happen for successful magic links or email confirmations
      // Both should result in email_confirmed_at being set after code exchange
      console.error(
        "Email not confirmed after code exchange for user:",
        user.id,
      );
      return NextResponse.redirect(`${origin}/login?error=email_not_confirmed`);
    }

    // Fetch profile to determine onboarding status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_completed, handle")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);

      // Profile should exist (created by DB trigger on signup)
      // If missing, create it and redirect to wizard
      if (profileError.code === "PGRST116") {
        // Not found
        console.log(
          "Profile not found, creating default profile for user:",
          user.id,
        );

        // Generate temporary handle from email hash (same as DB trigger)
        const tempHandle = createHash("md5")
          .update(user.email)
          .digest("hex")
          .substring(0, 12);

        const { error: createError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          handle: tempHandle,
          avatar_url: isOAuthFlow ? user.user_metadata?.avatar_url : null,
          onboarding_completed: false,
        });

        if (createError) {
          console.error("Error creating profile:", createError);
          return NextResponse.redirect(
            `${origin}/login?error=profile_creation_failed`,
          );
        }

        return NextResponse.redirect(`${origin}/wizard`);
      }

      return NextResponse.redirect(
        `${origin}/login?error=profile_fetch_failed`,
      );
    }

    // Determine redirect based on onboarding status
    if (profile?.onboarding_completed) {
      console.log(
        `User ${user.id} (${profile.handle}) completed onboarding, redirecting to dashboard`,
      );
      return NextResponse.redirect(`${origin}/dashboard`);
    } else {
      console.log(`User ${user.id} needs onboarding, redirecting to wizard`);
      return NextResponse.redirect(`${origin}/wizard`);
    }
  } catch (error) {
    // Catch unexpected errors (network issues, etc.)
    console.error("Unexpected error in auth callback:", error);
    return NextResponse.redirect(`${origin}/login?error=network_error`);
  }
}
