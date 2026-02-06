/**
 * Client-side utilities for managing the pending upload cookie via API.
 * Used by FileDropzone (homepage upload) and Wizard (post-auth claim flow).
 */

/**
 * Set pending upload cookie via API (primary storage)
 * Falls back silently if API call fails - sessionStorage remains as backup
 */
export async function setPendingUploadCookie(key: string): Promise<void> {
  try {
    await fetch("/api/upload/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  } catch (error) {
    console.warn("Failed to set pending upload cookie, using sessionStorage fallback:", error);
  }
}

/**
 * Clear pending upload cookie via API
 * Best effort - silent failure is acceptable
 */
export async function clearPendingUploadCookie(): Promise<void> {
  try {
    await fetch("/api/upload/pending", { method: "DELETE" });
  } catch (error) {
    console.warn("Failed to clear pending upload cookie:", error);
  }
}
