"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/auth/client";
import { type ForgotPasswordFormData, forgotPasswordSchema } from "@/lib/schemas/auth";

interface ForgotPasswordFormProps {
  /** Callback when user clicks back to sign in */
  onBackToSignIn?: () => void;
}

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
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-ink text-lg">Check your email</h3>
          <p className="text-ink/70 text-sm">
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
              text-ink/70
              hover:text-ink
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
        <label htmlFor="forgot-email" className="block text-sm font-bold text-ink">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={isSubmitting}
          {...register("email")}
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
            ${errors.email ? "border-coral" : ""}
          `}
        />
        {errors.email && <p className="text-sm text-coral font-medium">{errors.email.message}</p>}
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
            <span>Sending...</span>
          </>
        ) : (
          <span>Send reset link</span>
        )}
      </button>

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
            text-ink/70
            hover:text-ink
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
