"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Toaster } from "@/components/ui/sonner";
import { sendVerificationEmail } from "@/lib/auth/client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const email = searchParams.get("email");

  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResend = useCallback(async () => {
    if (!email || resendCooldown > 0) return;

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

  // Error state - token invalid or expired
  if (error) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <XCircle className="w-12 h-12 text-coral" />
        </div>
        <div className="space-y-2">
          <h2 className="font-bold text-ink text-lg">
            {error === "invalid_token" ? "Invalid Verification Link" : "Verification Failed"}
          </h2>
          <p className="text-ink/70 text-sm">
            {error === "invalid_token"
              ? "This verification link is invalid or has expired."
              : "There was a problem verifying your email."}
          </p>
        </div>

        {email && (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
            className="
              inline-block
              mt-4
              px-5
              py-2.5
              bg-ink
              text-cream
              font-black
              border-3
              border-ink
              shadow-brutal-sm
              hover:-translate-x-0.5
              hover:-translate-y-0.5
              hover:shadow-brutal-md
              active:translate-x-0
              active:translate-y-0
              active:shadow-none
              transition-all
              duration-150
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >
            {isResending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </span>
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              "Resend Verification Email"
            )}
          </button>
        )}

        <Link
          href="/"
          className="
            block
            text-sm
            font-medium
            text-ink/70
            hover:text-ink
            underline
            underline-offset-2
            transition-colors
            mt-4
          "
        >
          Back to home
        </Link>
      </div>
    );
  }

  // Success state - email verified
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <CheckCircle className="w-12 h-12 text-green-600" />
      </div>
      <div className="space-y-2">
        <h2 className="font-bold text-ink text-lg">Email Verified!</h2>
        <p className="text-ink/70 text-sm">
          Your email has been successfully verified. You can now access all features.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="
          inline-block
          mt-4
          px-5
          py-2.5
          bg-ink
          text-cream
          font-black
          border-3
          border-ink
          shadow-brutal-sm
          hover:-translate-x-0.5
          hover:-translate-y-0.5
          hover:shadow-brutal-md
          active:translate-x-0
          active:translate-y-0
          active:shadow-none
          transition-all
          duration-150
        "
      >
        Go to Dashboard
      </Link>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-8 h-8 animate-spin text-ink/50" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col paper-texture">
      <Toaster />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b-3 border-ink bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" aria-label="clickfolio.me home">
            <Logo size="md" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="
            w-full
            max-w-md
            bg-white
            border-3
            border-ink
            shadow-brutal-lg
            p-8
          "
        >
          <Suspense fallback={<LoadingFallback />}>
            <VerifyEmailContent />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}
