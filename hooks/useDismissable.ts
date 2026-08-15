"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persisted dismiss state backed by localStorage.
 *
 * Stores `Date.now()` under `key` when dismissed. On mount reads the stored
 * timestamp and considers the dismissal expired when `Date.now() - stored > durationMs`
 * (removing the key). Defaults to dismissed (true) until the effect corrects —
 * avoids flash of dismissible content before localStorage is read.
 * Silent fallback when localStorage is unavailable or stored value is malformed.
 *
 * @param key - localStorage key
 * @param durationMs - how long the dismissal lasts before it expires
 * @returns [isDismissed, dismiss] — `true` means hidden/dismissed
 */
export function useDismissable(key: string, durationMs: number): [boolean, () => void] {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const elapsed = Date.now() - Number.parseInt(stored, 10);
        if (!Number.isNaN(elapsed) && elapsed < durationMs) {
          setIsDismissed(true);
          return;
        }
        try {
          localStorage.removeItem(key);
        } catch {
          // silent — removal failure is non-fatal
        }
      }
      setIsDismissed(false);
    } catch {
      // localStorage unavailable or parse threw — show content (not dismissed)
      setIsDismissed(false);
    }
  }, [key, durationMs]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, Date.now().toString());
    } catch {
      // silent — storage write failure is non-fatal
    }
    setIsDismissed(true);
  }, [key]);

  return [isDismissed, dismiss];
}
