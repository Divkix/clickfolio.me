"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cooldown timer for resend actions.
 * Default 60 seconds. `start()` is no-op while already counting down.
 */
export function useResendCooldown(initialSeconds = 60) {
  const [cooldown, setCooldown] = useState(0);
  const ref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (ref.current) {
        clearInterval(ref.current);
        ref.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    if (cooldown > 0) return;
    setCooldown(initialSeconds);
    ref.current = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? (clearInterval(ref.current!), 0) : prev - 1));
    }, 1000);
  }, [cooldown, initialSeconds]);

  return { cooldown, start };
}
