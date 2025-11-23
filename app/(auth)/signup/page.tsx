"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, type SignupFormData } from "@/lib/schemas/auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginButton } from "@/components/auth/LoginButton";
import toast from "react-hot-toast";
import { Toaster } from "@/components/ui/sonner";
import { Mail, Eye, EyeOff } from "lucide-react";
import { evaluatePasswordStrength } from "@/lib/utils/password-strength";

type FormState = "idle" | "submitting" | "success";

export default function SignupPage() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>("idle");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
  });

  // Watch password field for strength indicator
  const passwordValue = watch("password");

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // User is already logged in, check onboarding status
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        if (profile?.onboarding_completed) {
          router.push("/dashboard");
        } else {
          router.push("/wizard");
        }
      } else {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router, supabase]);

  // Handle email/password signup
  const onSubmit = async (data: SignupFormData) => {
    setIsResending(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        // Handle specific error cases
        if (error.message.includes("already registered")) {
          toast.error("An account with this email already exists");
        } else if (error.message.includes("Password")) {
          toast.error("Password doesn't meet requirements");
        } else if (error.message.includes("Invalid email")) {
          toast.error("Please enter a valid email address");
        } else {
          toast.error(error.message);
        }
        setFormState("idle");
        return;
      }

      // Success - show success state
      setSubmittedEmail(data.email);
      setIsResending(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred during signup";
      toast.error(errorMessage);
      setFormState("idle");
    }
  };

  // Handle resend confirmation email
  const handleResendEmail = async () => {
    if (!submittedEmail) return;

    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: submittedEmail,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Confirmation email resent!");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to resend email";
      toast.error(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  const passwordStrengthResult = evaluatePasswordStrength(passwordValue || "");

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
                <p className="text-slate-600 mb-1">
                  We sent a confirmation link to
                </p>
                <p className="text-indigo-600 font-semibold mb-4">
                  {submittedEmail}
                </p>

                {/* Subtext */}
                <p className="text-sm text-slate-500 mb-6">
                  Click the link to verify your account and get started
                </p>

                {/* Resend Button */}
                <Button
                  onClick={handleResendEmail}
                  disabled={isResending}
                  variant="outline"
                  className="w-full transition-all duration-300"
                >
                  {isResending ? "Sending..." : "Resend email"}
                </Button>

                {/* Back to login */}
                <p className="mt-6 text-sm text-slate-600">
                  <Link
                    href="/login"
                    className="text-indigo-600 hover:text-indigo-700 underline font-semibold transition-colors"
                  >
                    Back to login
                  </Link>
                </p>
              </div>
            ) : (
              /* Signup Form */
              <>
                {/* Title Section */}
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    Create your account
                  </h1>
                  <p className="text-sm text-slate-600">
                    Get started in seconds
                  </p>
                </div>

                {/* Email/Password Form */}
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-4 mb-4"
                >
                  {/* Email Input */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...register("email")}
                      disabled={isResending}
                      aria-invalid={!!errors.email}
                      className="transition-all duration-300"
                    />
                    {errors.email && (
                      <p className="text-sm text-red-600">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        {...register("password")}
                        disabled={isResending}
                        aria-invalid={!!errors.password}
                        className="transition-all duration-300 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-red-600">
                        {errors.password.message}
                      </p>
                    )}

                    {/* Password Strength Indicator */}
                    {passwordValue && passwordValue.length > 0 && (
                      <div className="space-y-1">
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${passwordStrengthResult.barColor}`}
                            style={{
                              width: `${passwordStrengthResult.strength}%`,
                            }}
                          />
                        </div>
                        {passwordStrengthResult.label && (
                          <p
                            className={`text-xs font-medium ${passwordStrengthResult.color}`}
                          >
                            Password strength: {passwordStrengthResult.label}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        {...register("confirmPassword")}
                        disabled={isResending}
                        aria-invalid={!!errors.confirmPassword}
                        className="transition-all duration-300 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-600">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {/* TODO: Add Terms of Service and Privacy Policy pages before enabling this checkbox */}
                  {/* Terms acceptance will be required once legal pages are created */}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isResending}
                    className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
                  >
                    {formState === "submitting"
                      ? "Creating account..."
                      : "Create account"}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-500 font-medium">
                      Or
                    </span>
                  </div>
                </div>

                {/* Google OAuth Button */}
                <div>
                  <LoginButton
                    variant="outline"
                    size="default"
                    className="w-full transition-all duration-300 hover:shadow-depth-sm"
                    text="Continue with Google"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer Text */}
          {formState !== "success" && (
            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-indigo-600 hover:text-indigo-700 underline font-semibold transition-colors"
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
