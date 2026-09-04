"use client";

import { Check, Loader2, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteConfig } from "@/lib/config/site";

interface HandleStepProps {
  initialHandle?: string;
  onContinue: (handle: string) => void;
}

interface HandleCheckResponse {
  available: boolean;
  isCurrentHandle?: boolean;
  reason?: string;
  error?: string;
}

function generateSuggestions(handle: string): string[] {
  const suggestions: string[] = [];

  suggestions.push(`${handle}123`);

  suggestions.push(`${handle}-dev`);

  suggestions.push(`the${handle}`);

  const randomNum = Math.floor(Math.random() * 90) + 10;
  suggestions.push(`${handle}${randomNum}`);

  return suggestions.filter((s) => s.length >= 3 && s.length <= 30);
}

export function HandleStep({ initialHandle = "", onContinue }: HandleStepProps) {
  const [handle, setHandle] = useState(initialHandle);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isCurrentHandle, setIsCurrentHandle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availabilityAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => availabilityAbortRef.current?.abort();
  }, []);

  const suggestions = useMemo(() => {
    if (isAvailable === false && handle.length >= 3) {
      return generateSuggestions(handle);
    }
    return [];
  }, [isAvailable, handle]);

  const checkAvailability = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setIsAvailable(null);
      return;
    }

    availabilityAbortRef.current?.abort();
    const controller = new AbortController();
    availabilityAbortRef.current = controller;

    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch(`/api/handle/check?handle=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      });
      // SAFETY: HandleCheckResponse is from our /api/handle/check endpoint; shape validated server-side before use.
      const data = (await response.json()) as HandleCheckResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to check availability");
      }

      if (controller.signal.aborted) return;

      setIsAvailable(data.available);
      setIsCurrentHandle(data.isCurrentHandle === true);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Error checking handle availability:", err);
      setError("Failed to check availability");
      setIsAvailable(null);
    } finally {
      if (!controller.signal.aborted) {
        setIsChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (handle && handle.length >= 3) {
        void checkAvailability(handle);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [handle, checkAvailability]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
      .slice(0, 30);

    setHandle(value);

    setIsAvailable(null);
    setIsCurrentHandle(false);
    setError(null);

    if (value.length > 0 && value.length < 3) {
      setError("Handle must be at least 3 characters");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setHandle(suggestion);
    setIsAvailable(null);
    setIsCurrentHandle(false);
    setError(null);
    void checkAvailability(suggestion);
  };

  const handleSubmit = () => {
    if (isAvailable && handle.length >= 3) {
      onContinue(handle);
    }
  };

  const canContinue = isAvailable && handle.length >= 3 && !isChecking;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-brand-subtle rounded-xl flex items-center justify-center mb-6">
          <User className="w-8 h-8 text-brand" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
          Choose Your Handle
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          This will be your unique URL. Choose something professional and memorable.
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div className="space-y-2">
          <Label htmlFor="handle" className="text-sm font-semibold text-foreground">
            Your Handle
          </Label>
          <div className="relative">
            <Input
              id="handle"
              type="text"
              value={handle}
              onChange={handleChange}
              placeholder="johnsmith"
              className="pr-10 text-lg"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: focus handle input on mount
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isChecking && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
              {!isChecking && isAvailable === true && (
                <Check className={`w-5 h-5 ${isCurrentHandle ? "text-brand" : "text-success"}`} />
              )}
              {!isChecking && isAvailable === false && <X className="w-5 h-5 text-destructive" />}
            </div>
          </div>

          {handle && (
            <p className="text-sm text-muted-foreground font-medium">
              Your resume will be at:{" "}
              <span className="text-brand font-semibold font-mono">
                {siteConfig.domain}/@{handle}
              </span>
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive font-medium flex items-center gap-1">
              <X className="w-4 h-4" />
              {error}
            </p>
          )}
          {!isChecking && isAvailable === false && (
            <div className="space-y-3">
              <p className="text-sm text-destructive font-medium flex items-center gap-1">
                <X className="w-4 h-4" />
                This handle is already taken
              </p>

              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Try one of these:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-3 py-1.5 text-sm font-medium font-mono bg-card border border-border-strong rounded-md hover:bg-brand-subtle hover:border-brand transition-colors cursor-pointer"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!isChecking && isAvailable === true && isCurrentHandle && (
            <p className="text-sm text-brand font-medium flex items-center gap-1">
              <Check className="w-4 h-4" />
              This is your current handle
            </p>
          )}
          {!isChecking && isAvailable === true && !isCurrentHandle && (
            <p className="text-sm text-success font-medium flex items-center gap-1">
              <Check className="w-4 h-4" />
              This handle is available!
            </p>
          )}
        </div>

        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Requirements:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li className={handle.length >= 3 ? "text-success" : ""}>• At least 3 characters</li>
            <li className={/^[a-z0-9-]+$/.test(handle) ? "text-success" : ""}>
              • Only lowercase letters, numbers, and hyphens
            </li>
            <li className={!/^-|-$/.test(handle) ? "text-success" : ""}>
              • Cannot start or end with a hyphen
            </li>
          </ul>
        </div>

        <Button onClick={handleSubmit} disabled={!canContinue} className="w-full" size="lg">
          Continue
        </Button>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground font-medium">
          You can change your handle later in settings.
        </p>
      </div>
    </div>
  );
}
