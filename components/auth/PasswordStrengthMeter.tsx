"use client";

import { useMemo } from "react";
import type { PasswordStrengthResult } from "@/lib/password/strength";
import { cn } from "@/lib/utils/cn";

interface PasswordStrengthMeterProps {
  /** Result from checkPasswordStrength() */
  result: PasswordStrengthResult | null;
  /** Show breach warning if password found in breach database */
  breachCount?: number;
  /** Additional className */
  className?: string;
}

/**
 * Score-to-color mapping using semantic tokens
 * Maps zxcvbn scores (0-4) along a destructive → warning → success ramp
 */
const SCORE_COLORS = {
  0: "bg-destructive",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-success",
  4: "bg-success",
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
      <div
        className="flex gap-1"
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom segmented meter; <meter> semantics differ
        role="meter"
        aria-label="Password strength"
        aria-valuenow={result.score}
        aria-valuemin={0}
        aria-valuemax={4}
      >
        {segments.map((segment, i) => (
          <div
            key={`${segment.color}-${i}`}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-200",
              segment.active ? segment.color : "bg-border",
            )}
          />
        ))}
      </div>

      {/* Label and crack time */}
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn("font-semibold", {
            "text-destructive": result.score === 0 || result.score === 1,
            "text-warning": result.score === 2,
            "text-success": result.score === 3 || result.score === 4,
          })}
        >
          {label}
        </span>
        {result.crackTimeDisplay && (
          <span className="text-muted-foreground">Crack time: {result.crackTimeDisplay}</span>
        )}
      </div>

      {/* Breach warning */}
      {breachCount !== undefined && breachCount > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <strong>Warning:</strong> This password was found in {breachCount.toLocaleString()} data
          breach{breachCount > 1 ? "es" : ""}. Consider using a different password.
        </div>
      )}

      {/* Feedback */}
      {(result.feedback.warning || result.feedback.suggestions.length > 0) && (
        <div className="text-xs text-muted-foreground space-y-1">
          {result.feedback.warning && (
            <p className="font-medium text-destructive">{result.feedback.warning}</p>
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
