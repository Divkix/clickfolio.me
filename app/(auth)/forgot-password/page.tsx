"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/lib/schemas/auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import { Toaster } from "@/components/ui/sonner";
import { Mail } from "lucide-react";

type FormState = "idle" | "submitting" | "success" | "error";

// Artificial delay for timing attack protection (in milliseconds)
const SECURITY_DELAY_MS = 1500;

export default function ForgotPasswordPage() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
  });

  // Security: Add artificial delay to prevent timing attacks
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Handle forgot password form submission
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setFormState("submitting");

    try {
      // Record start time for timing normalization
      const startTime = Date.now();

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // Calculate elapsed time and add delay if needed to normalize response timing
      const elapsedTime = Date.now() - startTime;
      const remainingDelay = Math.max(0, SECURITY_DELAY_MS - elapsedTime);

      if (remainingDelay > 0) {
        await delay(remainingDelay);
      }

      // Security fix: Always show success state regardless of error
      // This prevents email enumeration attacks via timing or error message differences
      if (error) {
        // Log error server-side for debugging (don't expose to user)
        console.error("Password reset error:", error.message);

        // Only show error for rate limiting (security exception - prevents abuse)
        if (error.message.includes("rate limit")) {
          toast.error("Too many requests. Please try again later.");
          setFormState("error");
          return;
        }

        // For all other errors (including "User not found"), show success
        // The user cannot distinguish between "user exists" and "user doesn't exist"
      }

      // Always show success state to prevent email enumeration
      setSubmittedEmail(data.email);
      setFormState("success");
    } catch (error) {
      // Unexpected errors (network issues, etc.)
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send reset link";
      console.error("Unexpected password reset error:", errorMessage);

      // Even on unexpected errors, show success to prevent enumeration
      setSubmittedEmail(data.email);
      setFormState("success");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Toaster />

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-md shadow-depth-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-block">
            <Brand size="lg" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-depth-md p-8">
            {formState === "success" ? (
              /* Success State */
              <div className="text-center">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 mb-6 relative">
                  <div className="absolute inset-0 bg-linear-to-r from-indigo-600 to-blue-600 rounded-full opacity-20 blur-xl" />
                  <div className="relative w-full h-full bg-linear-to-r from-indigo-100 to-blue-100 rounded-full flex items-center justify-center">
                    <div className="w-10 h-10 bg-linear-to-r from-indigo-600 to-blue-600 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  Check your email
                </h1>

                {/* Message */}
                <p className="text-slate-600 mb-1">If an account exists with</p>
                <p className="text-indigo-600 font-semibold mb-4">
                  {submittedEmail}
                </p>

                {/* Subtext */}
                <p className="text-sm text-slate-500 mb-6">
                  we sent a password reset link. Check your inbox and spam
                  folder.
                </p>

                {/* Back to login */}
                <p className="mt-6 text-sm text-slate-600">
                  <Link
                    href="/login"
                    className="text-indigo-600 hover:text-indigo-700 underline font-semibold transition-colors"
                  >
                    Back to Sign in
                  </Link>
                </p>
              </div>
            ) : (
              /* Forgot Password Form */
              <>
                {/* Title Section */}
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    Forgot your password?
                  </h1>
                  <p className="text-sm text-slate-600">
                    Enter your email and we&apos;ll send you a reset link
                  </p>
                </div>

                {/* Email Form */}
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-4 mb-6"
                >
                  {/* Email Input */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      {...register("email")}
                      disabled={formState === "submitting"}
                      aria-invalid={!!errors.email}
                      className="transition-all duration-300"
                      autoFocus
                    />
                    {errors.email && (
                      <p className="text-sm text-red-600">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={formState === "submitting"}
                    className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
                  >
                    {formState === "submitting"
                      ? "Sending reset link..."
                      : "Send reset link"}
                  </Button>
                </form>

                {/* Back to login link */}
                <p className="text-center text-sm text-slate-600">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="text-indigo-600 hover:text-indigo-700 underline font-semibold transition-colors"
                  >
                    Back to Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
