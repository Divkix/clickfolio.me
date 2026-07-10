"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
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
  /** Override the default callback URL for all auth methods */
  callbackURL?: string;
}

/**
 * Authentication dialog supporting sign-in, sign-up, and forgot-password modes.
 * Switches between modes internally and delegates to sub-forms.
 */
export function AuthDialog({
  open,
  onOpenChange,
  defaultMode = "signin",
  callbackURL,
}: AuthDialogProps) {
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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-display font-bold text-center">
              {mode === "signin" && "Welcome back"}
              {mode === "signup" && "Create an account"}
              {mode === "forgot-password" && "Reset password"}
            </DialogTitle>
          </DialogHeader>

          {/* Mode Toggle - Only show for signin/signup */}
          {mode !== "forgot-password" && (
            <div className="flex mb-6 rounded-lg border border-border bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  mode === "signin"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  mode === "signup"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign up
              </button>
            </div>
          )}

          {/* Auth Content */}
          {mode === "signin" && (
            <div className="space-y-6">
              <GoogleButton
                fullWidth
                callbackURL={callbackURL || "/dashboard"}
                onSuccess={handleSuccess}
                authMode="signin"
              />

              <Divider />

              <SignInForm
                onSuccess={handleSuccess}
                onForgotPassword={handleForgotPassword}
                callbackURL={callbackURL}
              />
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-6">
              <GoogleButton
                fullWidth
                callbackURL={callbackURL || "/wizard"}
                text="Sign up with Google"
                onSuccess={handleSuccess}
                authMode="signup"
              />

              <Divider />

              <SignUpForm onSuccess={handleSuccess} callbackURL={callbackURL} />
            </div>
          )}

          {mode === "forgot-password" && (
            <div className="space-y-6">
              <p className="text-muted-foreground text-sm text-center">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <ForgotPasswordForm onBackToSignIn={handleBackToSignIn} />
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
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="px-3 bg-card text-muted-foreground font-medium">
          or continue with email
        </span>
      </div>
    </div>
  );
}
