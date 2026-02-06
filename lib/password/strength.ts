/**
 * Password strength validation using zxcvbn-ts
 *
 * Provides realistic password strength estimation based on entropy and
 * pattern matching rather than arbitrary complexity rules.
 *
 * Dependencies (~800KB uncompressed) are loaded lazily on first call
 * since 80%+ of users authenticate via Google OAuth and never need this.
 *
 * @see https://github.com/zxcvbn-ts/zxcvbn
 */

import type { ZxcvbnResult } from "@zxcvbn-ts/core";

/**
 * Minimum acceptable password strength score
 * Score 2 = "Somewhat guessable" - provides reasonable security
 * without being overly restrictive for a secondary auth method
 */
export const MINIMUM_SCORE = 2;

/**
 * Cached zxcvbn function after first dynamic import + initialization.
 * Avoids re-importing and re-configuring on subsequent calls.
 */
let cachedZxcvbn: ((password: string, userInputs?: string[]) => ZxcvbnResult) | null = null;

async function getZxcvbn() {
  if (cachedZxcvbn) return cachedZxcvbn;

  const [{ zxcvbn, zxcvbnOptions }, zxcvbnCommonPackage, zxcvbnEnPackage] = await Promise.all([
    import("@zxcvbn-ts/core"),
    import("@zxcvbn-ts/language-common"),
    import("@zxcvbn-ts/language-en"),
  ]);

  zxcvbnOptions.setOptions({
    translations: zxcvbnEnPackage.translations,
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
  });

  cachedZxcvbn = zxcvbn;
  return cachedZxcvbn;
}

/**
 * Password feedback from zxcvbn
 */
export interface PasswordFeedback {
  /** Primary warning about the password */
  warning: string;
  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Result of password strength check
 */
export interface PasswordStrengthResult {
  /**
   * Password strength score from 0-4
   * - 0: Too guessable (risky password)
   * - 1: Very guessable (easily crackable)
   * - 2: Somewhat guessable (provides some protection)
   * - 3: Safely unguessable (moderate protection)
   * - 4: Very unguessable (strong protection)
   */
  score: 0 | 1 | 2 | 3 | 4;

  /** Whether the password meets minimum requirements */
  isAcceptable: boolean;

  /** Feedback for improving the password */
  feedback: PasswordFeedback;

  /** Human-readable crack time estimate */
  crackTimeDisplay: string;

  /** Raw crack time in seconds (offline attack) */
  crackTimeSeconds: number;
}

/**
 * Check password strength using zxcvbn
 *
 * @param password - The password to check
 * @param userInputs - User-specific data to penalize (email, name, etc.)
 *                     Passwords containing these values will score lower
 * @returns Password strength result with score, feedback, and acceptability
 *
 * @example
 * ```ts
 * // Basic check
 * const result = await checkPasswordStrength("myp@ssword123");
 *
 * // With user context (penalizes passwords containing user data)
 * const result = await checkPasswordStrength("john_secure!", ["john@example.com", "John Doe"]);
 *
 * if (!result.isAcceptable) {
 *   console.log(result.feedback.warning);
 *   console.log(result.feedback.suggestions);
 * }
 * ```
 */
export async function checkPasswordStrength(
  password: string,
  userInputs: string[] = [],
): Promise<PasswordStrengthResult> {
  // Handle empty/undefined password
  if (!password) {
    return {
      score: 0,
      isAcceptable: false,
      feedback: {
        warning: "",
        suggestions: ["Use a longer password."],
      },
      crackTimeDisplay: "instant",
      crackTimeSeconds: 0,
    };
  }

  // Extract meaningful parts from user inputs for penalty
  // e.g., "john@example.com" -> ["john", "example"]
  const expandedInputs = userInputs.flatMap((input) => {
    const parts: string[] = [input.toLowerCase()];

    // Extract username from email
    if (input.includes("@")) {
      const [localPart] = input.split("@");
      if (localPart) parts.push(localPart.toLowerCase());
    }

    // Split name by spaces
    if (input.includes(" ")) {
      parts.push(...input.toLowerCase().split(/\s+/));
    }

    return parts.filter((p) => p.length > 2);
  });

  // Lazily load zxcvbn (cached after first call)
  const zxcvbn = await getZxcvbn();
  const result = zxcvbn(password, expandedInputs);

  return {
    score: result.score,
    isAcceptable: result.score >= MINIMUM_SCORE,
    feedback: {
      warning: result.feedback.warning || "",
      suggestions: result.feedback.suggestions || [],
    },
    crackTimeDisplay: result.crackTimesDisplay.offlineSlowHashing1e4PerSecond,
    crackTimeSeconds: result.crackTimesSeconds.offlineSlowHashing1e4PerSecond,
  };
}
