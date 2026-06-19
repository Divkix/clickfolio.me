"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth/client";
import { type ForgotPasswordFormData, forgotPasswordSchema } from "@/lib/schemas/auth";

interface ForgotPasswordFormProps {
  /** Callback when user clicks back to sign in */
  onBackToSignIn?: () => void;
}

/**
 * Forgot password form that sends a password reset link via email.
 * Displays a generic success message to prevent email enumeration.
 */
export function ForgotPasswordForm({ onBackToSignIn }: ForgotPasswordFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);

    try {
      const { error } = await requestPasswordReset({
        email: data.email,
        redirectTo: "/reset-password",
      });

      // The API returns success regardless of email existence (security best practice)
      // Only show error for actual server/network issues
      if (error) {
        console.error("Password reset request error:", error);
        toast.error("Something went wrong. Please try again.");
        return;
      }

      // Show success state - same message for existing and non-existing emails
      setIsSuccess(true);
    } catch (err) {
      // Catch any unexpected errors
      console.error("Password reset request error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state - generic message to prevent email enumeration
  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="w-12 h-12 text-success" />
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-foreground text-lg">Check your email</h3>
          <p className="text-muted-foreground text-sm">
            If an account exists with that email, we've sent password reset instructions.
          </p>
        </div>
        {onBackToSignIn && (
          <button
            type="button"
            onClick={onBackToSignIn}
            disabled={isSubmitting}
            className={`
              text-sm
              font-medium
              text-muted-foreground
              hover:text-foreground
              underline
              underline-offset-2
              transition-colors
              ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            Back to sign in
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email Field */}
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={isSubmitting}
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive font-medium">{errors.email.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" loading={isSubmitting} className="w-full mt-2">
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>

      {/* Back to sign in link */}
      {onBackToSignIn && (
        <button
          type="button"
          onClick={onBackToSignIn}
          disabled={isSubmitting}
          className={`
            w-full
            text-sm
            font-medium
            text-muted-foreground
            hover:text-foreground
            underline
            underline-offset-2
            transition-colors
            ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          Back to sign in
        </button>
      )}
    </form>
  );
}
