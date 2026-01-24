"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { signUp } from "@/lib/auth/client";
import { type SignUpFormData, signUpSchema } from "@/lib/schemas/auth";

interface SignUpFormProps {
  /** Callback when sign up succeeds, before redirect */
  onSuccess?: () => void;
}

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);

    try {
      const { error } = await signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
        callbackURL: "/wizard",
      });

      if (error) {
        // Handle specific error cases
        const message = error.message?.toLowerCase() || "";

        if (message.includes("email") && message.includes("exist")) {
          toast.error("An account with this email already exists");
        } else if (message.includes("password")) {
          toast.error("Password does not meet requirements");
        } else {
          toast.error(error.message || "Sign up failed. Please try again.");
        }
        return;
      }

      onSuccess?.();
      router.push("/wizard");
    } catch (err) {
      console.error("Sign up error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name Field */}
      <div className="space-y-1.5">
        <label htmlFor="signup-name" className="block text-sm font-bold text-ink">
          Name
        </label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          disabled={isSubmitting}
          {...register("name")}
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
            ${errors.name ? "border-coral" : ""}
          `}
        />
        {errors.name && <p className="text-sm text-coral font-medium">{errors.name.message}</p>}
      </div>

      {/* Email Field */}
      <div className="space-y-1.5">
        <label htmlFor="signup-email" className="block text-sm font-bold text-ink">
          Email
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" className="block text-sm font-bold text-ink">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 characters"
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
            <span>Creating account...</span>
          </>
        ) : (
          <span>Create account</span>
        )}
      </button>
    </form>
  );
}
