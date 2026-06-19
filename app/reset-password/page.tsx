"use client";

export const revalidate = 86400;

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { resetPassword } from "@/lib/auth/client";
import type { PasswordStrengthResult } from "@/lib/password/strength";
import { type ResetPasswordFormData, resetPasswordSchema } from "@/lib/schemas/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthResult | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue("newPassword", e.target.value, { shouldValidate: true });
    },
    [setValue],
  );

  const handleStrengthChange = useCallback((result: PasswordStrengthResult | null) => {
    setPasswordStrength(result);
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error("Invalid reset link. Please request a new one.");
      return;
    }

    // Check password strength before submitting
    if (!passwordStrength?.isAcceptable) {
      toast.error("Please choose a stronger password");
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
          <XCircle className="w-12 h-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="font-bold text-foreground text-lg">Invalid Reset Link</h2>
          <p className="text-muted-foreground text-sm">
            This password reset link is invalid or has expired.
          </p>
        </div>
        <Button asChild className="mt-4">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="w-12 h-12 text-success" />
        </div>
        <div className="space-y-2">
          <h2 className="font-bold text-foreground text-lg">Password Reset Successfully</h2>
          <p className="text-muted-foreground text-sm">
            Your password has been updated. You can now sign in with your new password.
          </p>
        </div>
        <Button asChild className="mt-4">
          <Link href="/">Sign In</Link>
        </Button>
      </div>
    );
  }

  // Reset password form
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2 mb-6">
        <h2 className="font-bold text-2xl text-foreground">Reset Password</h2>
        <p className="text-muted-foreground text-sm">Enter your new password below.</p>
      </div>

      {/* New Password Field with Strength Meter */}
      <div className="space-y-1.5">
        <Label htmlFor="reset-new-password">New Password</Label>
        <PasswordInput
          id="reset-new-password"
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          disabled={isSubmitting}
          value={watch("newPassword")}
          onChange={handlePasswordChange}
          showStrengthMeter
          checkBreach
          onStrengthChange={handleStrengthChange}
          hasError={!!errors.newPassword}
        />
        {errors.newPassword && (
          <p className="text-sm text-destructive font-medium">{errors.newPassword.message}</p>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm-password">Confirm Password</Label>
        <Input
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          disabled={isSubmitting}
          aria-invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive font-medium">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" loading={isSubmitting} className="w-full mt-2">
        {isSubmitting ? "Resetting..." : "Reset Password"}
      </Button>

      {/* Back to home link */}
      <Link
        href="/"
        className="
          block
          w-full
          text-center
          text-sm
          font-medium
          text-muted-foreground
          hover:text-foreground
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
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" aria-label="clickfolio.me home">
            <Logo size="md" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-sm p-8">
          <Suspense fallback={<LoadingFallback />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}
