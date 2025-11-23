"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/schemas/auth";
import toast from "react-hot-toast";

interface MagicLinkButtonProps {
  email: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export function MagicLinkButton({
  email,
  onSuccess,
  onError,
  disabled = false,
}: MagicLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMagicLink = async () => {
    // Validate email using Zod schema for consistency with auth validation
    const emailValidation = emailSchema.safeParse(email);

    if (!emailValidation.success) {
      const errorMessage =
        emailValidation.error.issues[0]?.message ||
        "Please enter a valid email address";
      toast.error(errorMessage);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: emailValidation.data,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      toast.success("Check your email for login link", {
        duration: 5000,
        icon: "📧",
      });

      onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send magic link";
      toast.error(errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleSendMagicLink}
      disabled={disabled || isLoading || !email}
      className="w-full transition-all duration-300 hover:shadow-depth-sm"
    >
      <Sparkles className="h-4 w-4" />
      {isLoading ? "Sending..." : "Send Magic Link"}
    </Button>
  );
}
