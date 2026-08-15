"use client";

import { AlertCircle, X } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDismissable } from "@/hooks/useDismissable";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import { sendVerificationEmail } from "@/lib/auth/client";

interface EmailVerificationBannerProps {
  /** User's email address */
  email: string;
  /** Whether the user's email is verified */
  emailVerified: boolean;
  /** Whether the user signed up via OAuth (Google) */
  isOAuthUser: boolean;
}

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
  const [isDismissed, handleDismiss] = useDismissable(
    "email_verification_dismissed",
    7 * 24 * 60 * 60 * 1000,
  );
  const [isResending, setIsResending] = useState(false);
  const { cooldown: resendCooldown, start: startCooldown } = useResendCooldown();

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
        startCooldown();
      }
    } catch (err) {
      console.error("Resend error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsResending(false);
    }
  }, [email, resendCooldown, startCooldown]);

  // Don't show for verified users or OAuth users
  if (emailVerified || isOAuthUser || isDismissed) {
    return null;
  }

  return (
    <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">Verify your email</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Please verify your email address ({email}) to ensure account security and receive
            important notifications.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleResend}
              loading={isResending}
              disabled={isResending || resendCooldown > 0}
            >
              {isResending
                ? "Sending..."
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend verification email"}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
