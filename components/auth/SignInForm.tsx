"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { signIn } from "@/lib/auth/client";
import { type SignInFormData, signInSchema } from "@/lib/schemas/auth";

interface SignInFormProps {
  /** Callback when sign in succeeds, before redirect */
  onSuccess?: () => void;
  /** Callback to switch to forgot password mode */
  onForgotPassword?: () => void;
}

export function SignInForm({ onSuccess, onForgotPassword }: SignInFormProps) {
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
      const { error } = await signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: "/dashboard",
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

      onSuccess?.();
      router.push("/dashboard");
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
        <label htmlFor="signin-email" className="block text-sm font-bold text-ink">
          Email
        </label>
        <input
          id="signin-email"
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

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="signin-password" className="block text-sm font-bold text-ink">
            Password
          </label>
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
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
              Forgot password?
            </button>
          )}
        </div>
        <input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          disabled={isSubmitting}
          {...register("password")}
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
            ${errors.password ? "border-coral" : ""}
          `}
        />
        {errors.password && (
          <p className="text-sm text-coral font-medium">{errors.password.message}</p>
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
            <span>Signing in...</span>
          </>
        ) : (
          <span>Sign in</span>
        )}
      </button>
    </form>
  );
}
