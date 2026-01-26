"use client";

import { useEffect, useRef } from "react";

interface AnalyticsBeaconProps {
  handle: string;
}

/**
 * Client-side analytics beacon — fires sendBeacon on mount.
 *
 * Why client-side: Public resume pages are edge-cached (s-maxage=3600).
 * SSR code runs at most once/hour per handle. A client-side beacon fires
 * on every page load regardless of cache.
 *
 * Renders nothing. Zero visual impact.
 */
export function AnalyticsBeacon({ handle }: AnalyticsBeaconProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    // Guard: only fire once per page load
    if (hasFired.current) return;

    // Skip prerendered or background tabs
    if (document.visibilityState !== "visible") return;

    // 150ms delay to avoid impacting LCP/FCP
    const timer = setTimeout(() => {
      if (hasFired.current) return;
      hasFired.current = true;

      const payload = JSON.stringify({
        handle,
        referrer: document.referrer || null,
      });

      const blob = new Blob([payload], { type: "application/json" });

      // sendBeacon is fire-and-forget, survives page unload
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon("/api/analytics/track", blob);
        if (!sent) {
          // Fallback: fetch with keepalive
          fetchFallback(payload);
        }
      } else {
        // Fallback for browsers without sendBeacon
        fetchFallback(payload);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [handle]);

  return null;
}

function fetchFallback(payload: string) {
  try {
    fetch("/api/analytics/track", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {
      // Analytics loss is acceptable
    });
  } catch {
    // Analytics loss is acceptable
  }
}
