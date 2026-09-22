"use client";

import { useCallback, useState } from "react";

function readDismissed(key: string, durationMs: number): boolean {
  try {
    const stored = localStorage.getItem(key);

    if (stored) {
      const elapsed = Date.now() - Number.parseInt(stored, 10);

      if (!Number.isNaN(elapsed) && elapsed < durationMs) {
        return true;
      }

      try {
        localStorage.removeItem(key);
      } catch {}
    }
  } catch {}

  return false;
}

export function useDismissable(key: string, durationMs: number): [boolean, () => void] {
  const [isDismissed, setIsDismissed] = useState(() => readDismissed(key, durationMs));
  const [prevKey, setPrevKey] = useState(key);
  const [prevDurationMs, setPrevDurationMs] = useState(durationMs);

  if (key !== prevKey || durationMs !== prevDurationMs) {
    setPrevKey(key);
    setPrevDurationMs(durationMs);
    setIsDismissed(readDismissed(key, durationMs));
  }

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, Date.now().toString());
    } catch {}

    setIsDismissed(true);
  }, [key]);

  return [isDismissed, dismiss];
}
