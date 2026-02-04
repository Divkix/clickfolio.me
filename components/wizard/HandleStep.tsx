"use client";

import { Check, Loader2, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

/**
 * Generate alternative handle suggestions when a handle is taken
 */
function generateSuggestions(handle: string): string[] {
  const suggestions: string[] = [];

  // Add numbers suffix
  suggestions.push(`${handle}123`);

  // Add -dev suffix
  suggestions.push(`${handle}-dev`);

  // Add "the" prefix
  suggestions.push(`the${handle}`);

  // Add random 2-digit number
  const randomNum = Math.floor(Math.random() * 90) + 10; // 10-99
  suggestions.push(`${handle}${randomNum}`);

  // Filter out suggestions that are too long (max 30 chars) or too short (min 3)
  return suggestions.filter((s) => s.length >= 3 && s.length <= 30);
}

/**
 * Step 1: Handle Selection Component
 * Allows users to choose their unique username/handle
 */
export function HandleStep({ initialHandle = "", onContinue }: HandleStepProps) {
  const [handle, setHandle] = useState(initialHandle);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isCurrentHandle, setIsCurrentHandle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate suggestions when handle is taken
  const suggestions = useMemo(() => {
    if (isAvailable === false && handle.length >= 3) {
      return generateSuggestions(handle);
    }
    return [];
  }, [isAvailable, handle]);

  // Debounced availability check via API route
  const checkAvailability = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch(`/api/handle/check?handle=${encodeURIComponent(value)}`);
      const data = (await response.json()) as HandleCheckResponse;

      if (!response.ok) {
        throw new Error(data.error || "Failed to check availability");
      }

      setIsAvailable(data.available);
      setIsCurrentHandle(data.isCurrentHandle === true);
    } catch (err) {
      console.error("Error checking handle availability:", err);
      setError("Failed to check availability");
      setIsAvailable(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Debounce the availability check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (handle && handle.length >= 3) {
        checkAvailability(handle);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [handle, checkAvailability]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "") // Only allow alphanumeric and hyphens
      .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
      .replace(/-+/g, "-") // Collapse multiple hyphens
      .slice(0, 30); // Max 30 characters

    setHandle(value);

    // Reset states while typing
    setIsAvailable(null);
    setIsCurrentHandle(false);
    setError(null);

    // Validate length
    if (value.length > 0 && value.length < 3) {
      setError("Handle must be at least 3 characters");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setHandle(suggestion);
    setIsAvailable(null);
    setIsCurrentHandle(false);
    setError(null);
    // Trigger immediate availability check
    checkAvailability(suggestion);
  };

  const handleSubmit = () => {
    if (isAvailable && handle.length >= 3) {
      onContinue(handle);
    }
  };

  const canContinue = isAvailable && handle.length >= 3 && !isChecking;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-linear-to-r from-coral/20 to-coral/20 rounded-2xl flex items-center justify-center mb-6">
          <User className="w-8 h-8 text-coral" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Choose Your Handle
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          This will be your unique URL. Choose something professional and memorable.
        </p>
      </div>

      {/* Handle Input */}
      <div className="max-w-md mx-auto space-y-4">
        <div className="space-y-2">
          <Label htmlFor="handle" className="text-sm font-semibold text-slate-700">
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
              autoFocus
            />
            {/* Status Icon */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isChecking && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
              {!isChecking && isAvailable === true && (
                <Check className={`w-5 h-5 ${isCurrentHandle ? "text-coral" : "text-green-600"}`} />
              )}
              {!isChecking && isAvailable === false && <X className="w-5 h-5 text-coral" />}
            </div>
          </div>

          {/* URL Preview */}
          {handle && (
            <p className="text-sm text-slate-500 font-medium">
              Your resume will be at:{" "}
              <span className="text-coral font-semibold">
                {siteConfig.domain}/{handle}
              </span>
            </p>
          )}

          {/* Error/Success Messages */}
          {error && (
            <p className="text-sm text-coral font-medium flex items-center gap-1">
              <X className="w-4 h-4" />
              {error}
            </p>
          )}
          {!isChecking && isAvailable === false && (
            <div className="space-y-3">
              <p className="text-sm text-coral font-medium flex items-center gap-1">
                <X className="w-4 h-4" />
                This handle is already taken
              </p>

              {/* Handle Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Try one of these:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-3 py-1.5 text-sm font-medium bg-slate-50 border-2 border-slate-900 rounded-md hover:bg-coral/10 hover:border-coral transition-colors cursor-pointer"
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
            <p className="text-sm text-coral font-medium flex items-center gap-1">
              <Check className="w-4 h-4" />
              This is your current handle
            </p>
          )}
          {!isChecking && isAvailable === true && !isCurrentHandle && (
            <p className="text-sm text-green-600 font-medium flex items-center gap-1">
              <Check className="w-4 h-4" />
              This handle is available!
            </p>
          )}
        </div>

        {/* Requirements */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-700 mb-2">Requirements:</p>
          <ul className="text-xs text-slate-600 space-y-1">
            <li className={handle.length >= 3 ? "text-green-600" : ""}>• At least 3 characters</li>
            <li className={/^[a-z0-9-]+$/.test(handle) ? "text-green-600" : ""}>
              • Only lowercase letters, numbers, and hyphens
            </li>
            <li className={!/^-|-$/.test(handle) ? "text-green-600" : ""}>
              • Cannot start or end with a hyphen
            </li>
          </ul>
        </div>

        {/* Continue Button */}
        <Button
          onClick={handleSubmit}
          disabled={!canContinue}
          className="w-full bg-linear-to-r from-coral to-coral hover:from-coral/90 hover:to-coral/90 text-white font-semibold shadow-depth-sm hover:shadow-depth-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          size="lg"
        >
          Continue
        </Button>
      </div>

      {/* Help Text */}
      <div className="text-center">
        <p className="text-sm text-slate-500 font-medium">
          You can change your handle later in settings.
        </p>
      </div>
    </div>
  );
}
