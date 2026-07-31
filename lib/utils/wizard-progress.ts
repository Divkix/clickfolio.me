/**
 * Client-side wizard step progress persistence.
 *
 * The wizard's step state (current step + handle/privacy/theme choices) lives
 * in React state and is lost on a refresh or back-navigation. These helpers
 * mirror that state to `localStorage` so a returning user resumes where they
 * left off instead of restarting.
 *
 * - Saved state has a 24h TTL (matches the pending-upload cookie window).
 * - Only persists once the user has moved past the upload step (so we don't
 *   pin someone to the upload step if they have no resume yet).
 * - Cleared on successful wizard completion and when onboarding is already
 *   completed.
 */

import type { ThemeId } from "@/lib/templates/theme-ids";

const WIZARD_PROGRESS_KEY = "clickfolio:wizard-progress";
const PROGRESS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type WizardStepId = "upload" | "handle" | "review" | "privacy" | "theme";

export interface WizardProgress {
  currentStepId: WizardStepId;
  handle: string;
  privacySettings: {
    show_phone: boolean;
    show_address: boolean;
    show_in_directory: boolean;
    hide_from_search: boolean;
  };
  themeId: ThemeId;
  savedAt: number;
}

interface StoredProgress extends Omit<WizardProgress, "savedAt"> {
  savedAt: number;
}

/**
 * Persist the current wizard step + choices to localStorage.
 * Best-effort: silently ignores storage errors (private mode, quota, SSR).
 */
export function saveWizardProgress(progress: Omit<WizardProgress, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredProgress = { ...progress, savedAt: Date.now() };
    window.localStorage.setItem(WIZARD_PROGRESS_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures — progress saving is a nicety, not a requirement.
  }
}

/**
 * Read persisted wizard progress if it exists and is within the TTL.
 * Returns null on SSR, missing key, parse failure, or expiry.
 */
export function loadWizardProgress(): WizardProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WIZARD_PROGRESS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredProgress;
    if (typeof parsed.savedAt !== "number") return null;

    // Expired — clean up and ignore.
    if (Date.now() - parsed.savedAt > PROGRESS_TTL_MS) {
      window.localStorage.removeItem(WIZARD_PROGRESS_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear persisted wizard progress. Called on successful completion or when
 * onboarding is already done.
 */
export function clearWizardProgress(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WIZARD_PROGRESS_KEY);
  } catch {
    // Ignore.
  }
}
