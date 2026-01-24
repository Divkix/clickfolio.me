"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GoogleButton } from "./GoogleButton";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

type AuthMode = "signin" | "signup" | "forgot-password";

interface AuthDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Initial mode, defaults to "signin" */
  defaultMode?: AuthMode;
}

export function AuthDialog({ open, onOpenChange, defaultMode = "signin" }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);

  const handleSuccess = () => {
    onOpenChange(false);
  };

  const handleForgotPassword = () => {
    setMode("forgot-password");
  };

  const handleBackToSignIn = () => {
    setMode("signin");
  };

  // Reset mode when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset to default mode when closing
      setMode(defaultMode);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="
          bg-cream
          border-3
          border-ink
          shadow-brutal-lg
          rounded-none
          sm:max-w-md
          p-0
          overflow-hidden
        "
      >
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-ink text-center">
              {mode === "signin" && "Welcome back"}
              {mode === "signup" && "Create an account"}
              {mode === "forgot-password" && "Reset password"}
            </DialogTitle>
          </DialogHeader>

          {/* Mode Toggle - Only show for signin/signup */}
          {mode !== "forgot-password" && (
            <div className="flex mb-6 border-3 border-ink">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`
                  flex-1
                  px-4
                  py-2
                  font-bold
                  text-sm
                  transition-colors
                  ${mode === "signin" ? "bg-ink text-cream" : "bg-cream text-ink hover:bg-ink/10"}
                `}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`
                  flex-1
                  px-4
                  py-2
                  font-bold
                  text-sm
                  border-l-3
                  border-ink
                  transition-colors
                  ${mode === "signup" ? "bg-ink text-cream" : "bg-cream text-ink hover:bg-ink/10"}
                `}
              >
                Sign up
              </button>
            </div>
          )}

          {/* Auth Content */}
          {mode === "signin" && (
            <div className="space-y-6">
              <GoogleButton fullWidth callbackURL="/dashboard" onSuccess={handleSuccess} />

              <Divider />

              <SignInForm onSuccess={handleSuccess} onForgotPassword={handleForgotPassword} />
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-6">
              <GoogleButton
                fullWidth
                callbackURL="/wizard"
                text="Sign up with Google"
                onSuccess={handleSuccess}
              />

              <Divider />

              <SignUpForm onSuccess={handleSuccess} />
            </div>
          )}

          {mode === "forgot-password" && (
            <div className="space-y-6">
              <p className="text-ink/70 text-sm text-center">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {/* Placeholder for ForgotPasswordForm - will be added in task 2.3 */}
              <div className="text-center py-8 text-ink/50 text-sm">Password reset coming soon</div>

              <button
                type="button"
                onClick={handleBackToSignIn}
                className="
                  w-full
                  text-sm
                  font-medium
                  text-ink/70
                  hover:text-ink
                  underline
                  underline-offset-2
                  transition-colors
                "
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t-2 border-ink/20" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="px-3 bg-cream text-ink/50 font-medium">or continue with email</span>
      </div>
    </div>
  );
}
