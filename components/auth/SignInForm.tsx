"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import posthog from "posthog-js";
import { signIn } from "@/lib/auth/client";
import { type SignInFormData, signInSchema } from "@/lib/schemas/auth";

interface SignInFormProps {
  /** Callback when sign in succeeds, before redirect */
  onSuccess?: () => void;
  /** Callback to switch to forgot password mode */
  onForgotPassword?: () => void;
  /** Override the default callback URL (defaults to /dashboard) */
  callbackURL?: string;
}

/**
 * Email/password sign-in form with validation and error handling.
 * Integrates with Better Auth for credential-based authentication.
 */
export function SignInForm({ onSuccess, onForgotPassword, callbackURL }: SignInFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsSubmitting(true);

    try {
      const redirectURL = callbackURL || "/dashboard";
      const { error } = await signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: redirectURL,
      });

      if (error) {
        // Handle specific error cases
        const message = error.message?.toLowerCase() || "";

        if (message.includes("invalid") || message.includes("credential")) {
          toast.error("Invalid email or password");
        } else if (message.includes("not found") || message.includes("no user")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message || "Sign in failed. Please try again.");
        }
        return;
      }

      posthog.capture("sign_in_completed", { method: "email" });

      onSuccess?.();
      router.push(redirectURL);
    } catch (err) {
      console.error("Sign in error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email Field */}
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
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

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
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
              Forgot password?
            </button>
          )}
        </div>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          disabled={isSubmitting}
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive font-medium">{errors.password.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" loading={isSubmitting} className="w-full mt-2">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
