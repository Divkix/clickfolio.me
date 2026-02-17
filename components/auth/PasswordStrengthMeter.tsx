"use client";

import { useMemo } from "react";
import type { PasswordStrengthResult } from "@/lib/password/strength";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  /** Result from checkPasswordStrength() */
  result: PasswordStrengthResult | null;
  /** Show breach warning if password found in breach database */
  breachCount?: number;
  /** Additional className */
  className?: string;
}

/**
 * Score-to-color mapping for neubrutalist design
 * Maps zxcvbn scores (0-4) to Tailwind colors
 */
const SCORE_COLORS = {
  0: "bg-red-500",
  1: "bg-coral",
  2: "bg-amber-500",
  3: "bg-lime-500",
  4: "bg-green-500",
} as const;

/**
 * Score-to-label mapping
 */
const SCORE_LABELS = {
  0: "Very weak",
  1: "Weak",
  2: "Fair",
  3: "Strong",
  4: "Very strong",
} as const;

/**
 * Visual password strength indicator
 *
 * Displays a 4-segment strength bar with feedback and crack time estimate.
 * Matches the neubrutalist design system.
 */
export function PasswordStrengthMeter({
  result,
  breachCount,
  className,
}: PasswordStrengthMeterProps) {
  const segments = useMemo(() => {
    if (!result) return [];

    // Create 4 segments for scores 1-4 (score 0 shows nothing)
    return Array.from({ length: 4 }, (_, i) => ({
      active: result.score > i,
      color: SCORE_COLORS[result.score],
    }));
  }, [result]);

  if (!result) return null;

  const label = SCORE_LABELS[result.score];

  return (
    <div className={cn("space-y-2", className)}>
      {/* Strength bar - 4 segments */}
      {/* biome-ignore lint/a11y/useSemanticElements: meter element cannot render segmented strength bars */}
      <div
        className="flex gap-1"
        role="meter"
        aria-label="Password strength"
        aria-valuenow={result.score}
        aria-valuemin={0}
        aria-valuemax={4}
      >
        {segments.map((segment, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-200",
              segment.active ? segment.color : "bg-ink/10",
            )}
          />
        ))}
      </div>

      {/* Label and crack time */}
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn("font-semibold", {
            "text-red-600": result.score === 0,
            "text-coral": result.score === 1,
            "text-amber-600": result.score === 2,
            "text-lime-600": result.score === 3,
            "text-green-600": result.score === 4,
          })}
        >
          {label}
        </span>
        {result.crackTimeDisplay && (
          <span className="text-ink/50">Crack time: {result.crackTimeDisplay}</span>
        )}
      </div>

      {/* Breach warning */}
      {breachCount !== undefined && breachCount > 0 && (
        <div className="rounded border-2 border-coral bg-coral/10 px-3 py-2 text-xs text-coral">
          <strong>Warning:</strong> This password was found in {breachCount.toLocaleString()} data
          breach{breachCount > 1 ? "es" : ""}. Consider using a different password.
        </div>
      )}

      {/* Feedback */}
      {(result.feedback.warning || result.feedback.suggestions.length > 0) && (
        <div className="text-xs text-ink/70 space-y-1">
          {result.feedback.warning && (
            <p className="font-medium text-coral">{result.feedback.warning}</p>
          )}
          {result.feedback.suggestions.length > 0 && (
            <ul className="list-disc list-inside space-y-0.5">
              {result.feedback.suggestions.map((suggestion, i) => (
                <li key={i}>{suggestion}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
