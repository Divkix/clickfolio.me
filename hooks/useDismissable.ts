"use client";

import { useCallback, useEffect, useState } from "react";

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
        } catch {}
      }
      setIsDismissed(false);
    } catch {
      setIsDismissed(false);
    }
  }, [key, durationMs]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, Date.now().toString());
    } catch {}
    setIsDismissed(true);
  }, [key]);

  return [isDismissed, dismiss];
}
