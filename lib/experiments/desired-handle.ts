import { handleSchema } from "@/lib/schemas/profile";

// Handle typed on the claim-handle landing variant, carried across the
// upload → Google sign-in redirect → wizard hop. localStorage (not session)
// so a sign-in completed in another tab still finds it.
const DESIRED_HANDLE_KEY = "clickfolio:desired_handle";

export function saveDesiredHandle(handle: string): void {
  try {
    localStorage.setItem(DESIRED_HANDLE_KEY, handle);
  } catch {}
}

/**
 * Returns the saved handle, or null if absent or no longer valid. Not cleared on
 * read: the wizard can bounce through /waiting and re-initialize before the
 * handle step, so it is cleared once the user confirms a handle.
 */
export function readDesiredHandle(): string | null {
  try {
    const value = localStorage.getItem(DESIRED_HANDLE_KEY);

    return handleSchema.safeParse(value).success ? value : null;
  } catch {
    return null;
  }
}

export function clearDesiredHandle(): void {
  try {
    localStorage.removeItem(DESIRED_HANDLE_KEY);
  } catch {}
}
