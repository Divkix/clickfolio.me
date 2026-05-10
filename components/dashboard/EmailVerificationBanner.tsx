"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { sendVerificationEmail } from "@/lib/auth/client";

interface EmailVerificationBannerProps {
  /** User's email address */
  email: string;
  /** Whether the user's email is verified */
  emailVerified: boolean;
  /** Whether the user signed up via OAuth (Google) */
  isOAuthUser: boolean;
}

const DISMISS_KEY = "email_verification_dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Dismissible email verification warning banner
 *
 * Shows for email/password users who haven't verified their email.
 * Hidden for OAuth users (already verified by provider).
 * Dismissible, but reappears after 7 days if still unverified.
 */
export function EmailVerificationBanner({
  email,
  emailVerified,
  isOAuthUser,
}: EmailVerificationBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to avoid flash
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check localStorage for dismiss state
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number.parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION) {
        setIsDismissed(true);
        return;
      }
      // Dismiss expired, clear it
      localStorage.removeItem(DISMISS_KEY);
    }
    setIsDismissed(false);
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
  }, []);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    try {
      const { error } = await sendVerificationEmail({
        email,
        callbackURL: "/verify-email",
      });

      if (error) {
        toast.error(error.message || "Failed to resend verification email");
      } else {
        toast.success("Verification email sent! Check your inbox.");
        // Start 60 second cooldown
        setResendCooldown(60);
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      console.error("Resend error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsResending(false);
    }
  }, [email, resendCooldown]);

  // Don't show for verified users or OAuth users
  if (emailVerified || isOAuthUser || isDismissed) {
    return null;
  }

  return (
    <div className="bg-amber/5 border-2 border-amber rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">Verify your email</h3>
          <p className="mt-1 text-sm text-amber">
            Please verify your email address ({email}) to ensure account security and receive
            important notifications.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="
                px-3
                py-1.5
                bg-amber
                hover:bg-amber/90
                text-white
                text-sm
                font-semibold
                rounded-md
                transition-colors
                disabled:opacity-50
                disabled:cursor-not-allowed
                flex
                items-center
                gap-2
              "
            >
              {isResending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                "Resend verification email"
              )}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-amber/80 hover:text-amber p-1 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
