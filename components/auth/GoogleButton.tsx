"use client";

import { Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";
import { signIn } from "@/lib/auth/client";

interface GoogleButtonProps {
  /** URL to redirect to after successful sign in */
  callbackURL?: string;
  /** Button text, defaults to "Continue with Google" */
  text?: string;
  /** Full width button for use in forms */
  fullWidth?: boolean;
  /** Callback after successful sign in initiation */
  onSuccess?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /**
   * Auth surface that rendered this button. Used only for analytics event naming
   * (OAuth does not distinguish sign-in vs sign-up until after the round-trip).
   */
  authMode?: "signin" | "signup";
}

export function GoogleButton({
  callbackURL = "/wizard",
  text = "Continue with Google",
  fullWidth = false,
  onSuccess,
  disabled = false,
  authMode = "signin",
}: GoogleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    try {
      await signIn.social({
        provider: "google",
        callbackURL,
      });

      // After a successful handoff (errors throw). authMode is the UI surface
      // (sign-in vs sign-up tab), not a verified new-vs-returning outcome.
      posthog.capture(authMode === "signup" ? "sign_up_completed" : "sign_in_completed", {
        method: "google",
      });

      onSuccess?.();
    } catch (error) {
      console.error("Google sign in error:", error);

      // Show user-friendly error message
      let message = "Sign in failed. Please try again.";
      if (error instanceof Error) {
        if (error.message?.toLowerCase().includes("popup")) {
          message = "Popup blocked. Please allow popups for this site.";
        } else if (
          error.message?.toLowerCase().includes("network") ||
          error.message?.toLowerCase().includes("fetch")
        ) {
          message = "Network error. Check your connection.";
        } else if (error.message?.toLowerCase().includes("cancel")) {
          message = "Sign in was cancelled.";
        }
      }

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={isDisabled}
      className={`
        inline-flex
        items-center
        gap-2
        h-9
        px-4
        py-2
        rounded-md
        border
        border-border-strong
        bg-card
        text-foreground
        text-sm
        font-medium
        shadow-xs
        transition-colors
        hover:bg-surface-2
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-ring
        focus-visible:ring-offset-2
        focus-visible:ring-offset-background
        disabled:opacity-50
        disabled:pointer-events-none
        ${fullWidth ? "w-full justify-center" : ""}
      `}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Signing in...</span>
        </>
      ) : (
        <>
          <GoogleIcon />
          <span>{text}</span>
        </>
      )}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
