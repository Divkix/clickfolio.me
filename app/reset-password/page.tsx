"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Toaster } from "@/components/ui/sonner";
import { resetPassword } from "@/lib/auth/client";
import { type ResetPasswordFormData, resetPasswordSchema } from "@/lib/schemas/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error("Invalid reset link. Please request a new one.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await resetPassword({
        newPassword: data.newPassword,
        token,
      });

      if (error) {
        const message = error.message?.toLowerCase() || "";

        if (message.includes("expired") || message.includes("invalid")) {
          toast.error("This reset link has expired. Please request a new one.");
        } else if (message.includes("password")) {
          toast.error("Password does not meet requirements.");
        } else {
          toast.error(error.message || "Failed to reset password. Please try again.");
        }
        return;
      }

      setIsSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // No token - show error state
  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <XCircle className="w-12 h-12 text-coral" />
        </div>
        <div className="space-y-2">
          <h2 className="font-bold text-ink text-lg">Invalid Reset Link</h2>
          <p className="text-ink/70 text-sm">This password reset link is invalid or has expired.</p>
        </div>
        <Link
          href="/"
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
          Back to Home
        </Link>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <div className="space-y-2">
          <h2 className="font-bold text-ink text-lg">Password Reset Successfully</h2>
          <p className="text-ink/70 text-sm">
            Your password has been updated. You can now sign in with your new password.
          </p>
        </div>
        <Link
          href="/"
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
          Sign In
        </Link>
      </div>
    );
  }

  // Reset password form
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2 mb-6">
        <h2 className="font-black text-2xl text-ink">Reset Password</h2>
        <p className="text-ink/70 text-sm">Enter your new password below.</p>
      </div>

      {/* New Password Field */}
      <div className="space-y-1.5">
        <label htmlFor="reset-new-password" className="block text-sm font-bold text-ink">
          New Password
        </label>
        <input
          id="reset-new-password"
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          disabled={isSubmitting}
          {...register("newPassword")}
          className={`
            w-full
            px-4
            py-2.5
            bg-cream
            text-ink
            font-medium
            border-3
            border-ink
            shadow-brutal-sm
            placeholder:text-ink/40
            focus:outline-none
            focus:shadow-brutal-md
            focus:translate-x-[-2px]
            focus:translate-y-[-2px]
            transition-all
            duration-150
            disabled:opacity-50
            disabled:cursor-not-allowed
            ${errors.newPassword ? "border-coral" : ""}
          `}
        />
        {errors.newPassword && (
          <p className="text-sm text-coral font-medium">{errors.newPassword.message}</p>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-1.5">
        <label htmlFor="reset-confirm-password" className="block text-sm font-bold text-ink">
          Confirm Password
        </label>
        <input
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          disabled={isSubmitting}
          {...register("confirmPassword")}
          className={`
            w-full
            px-4
            py-2.5
            bg-cream
            text-ink
            font-medium
            border-3
            border-ink
            shadow-brutal-sm
            placeholder:text-ink/40
            focus:outline-none
            focus:shadow-brutal-md
            focus:translate-x-[-2px]
            focus:translate-y-[-2px]
            transition-all
            duration-150
            disabled:opacity-50
            disabled:cursor-not-allowed
            ${errors.confirmPassword ? "border-coral" : ""}
          `}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-coral font-medium">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="
          w-full
          mt-2
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
          disabled:hover:translate-x-0
          disabled:hover:translate-y-0
          disabled:hover:shadow-brutal-sm
          flex
          items-center
          justify-center
          gap-2
        "
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Resetting...</span>
          </>
        ) : (
          <span>Reset Password</span>
        )}
      </button>

      {/* Back to home link */}
      <Link
        href="/"
        className="
          block
          w-full
          text-center
          text-sm
          font-medium
          text-ink/70
          hover:text-ink
          underline
          underline-offset-2
          transition-colors
        "
      >
        Back to home
      </Link>
    </form>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-8 h-8 animate-spin text-ink/50" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col paper-texture">
      <Toaster />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b-3 border-ink bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" aria-label="webresume.now home">
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
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}
