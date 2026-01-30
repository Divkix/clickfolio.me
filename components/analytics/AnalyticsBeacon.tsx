"use client";

import { useEffect, useRef } from "react";

interface AnalyticsBeaconProps {
  handle: string;
}

interface AnalyticsEvent {
  handle: string;
  referrer: string | null;
  ts: number;
}

const BATCH_SIZE = 5;
const SESSION_KEY = "analytics_queue";
const TRACK_ENDPOINT = "/api/analytics/track";

/**
 * Client-side analytics beacon with batching.
 *
 * Why batching: Reduces D1 operations by collecting 5 page views before
 * sending a single batch request. Remaining events flush on page unload.
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

    // Check if sessionStorage is available (SSR guard, private browsing)
    if (!isSessionStorageAvailable()) {
      // Fallback: send immediately without batching
      sendImmediately(handle);
      hasFired.current = true;
      return;
    }

    // 150ms delay to avoid impacting LCP/FCP
    const timer = setTimeout(() => {
      if (hasFired.current) return;
      hasFired.current = true;

      const event: AnalyticsEvent = {
        handle,
        referrer: document.referrer || null,
        ts: Date.now(),
      };

      const queue = getQueue();
      queue.push(event);

      if (queue.length >= BATCH_SIZE) {
        flushQueue(queue);
        clearQueue();
      } else {
        saveQueue(queue);
      }
    }, 150);

    // Flush remaining events on page unload
    const handleUnload = () => {
      const queue = getQueue();
      if (queue.length === 0) return;

      const payload = JSON.stringify(queue);

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(TRACK_ENDPOINT, blob);
      }
      // Note: fetch with keepalive is unreliable during unload
      // If sendBeacon fails/unavailable, we accept the loss

      clearQueue();
    };

    window.addEventListener("beforeunload", handleUnload);

    // Also flush on visibilitychange to hidden (mobile tab switch, app switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleUnload();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handle]);

  return null;
}

/**
 * Check if sessionStorage is available (fails in SSR, private browsing, iframe sandboxes)
 */
function isSessionStorageAvailable(): boolean {
  try {
    const testKey = "__analytics_test__";
    sessionStorage.setItem(testKey, "1");
    sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely retrieve queue from sessionStorage with error handling
 */
function getQueue(): AnalyticsEvent[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    // Validate it's an array
    if (!Array.isArray(parsed)) {
      clearQueue();
      return [];
    }
    return parsed;
  } catch {
    // Corrupted data, reset
    clearQueue();
    return [];
  }
}

/**
 * Save queue to sessionStorage
 */
function saveQueue(queue: AnalyticsEvent[]): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable, attempt to flush what we have
    if (queue.length > 0) {
      flushQueue(queue);
    }
  }
}

/**
 * Remove queue from sessionStorage
 */
function clearQueue(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore removal failures
  }
}

/**
 * Send batched events to the server
 */
function flushQueue(queue: AnalyticsEvent[]): void {
  if (queue.length === 0) return;

  const payload = JSON.stringify(queue);

  try {
    fetch(TRACK_ENDPOINT, {
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

/**
 * Fallback: send single event immediately when sessionStorage unavailable
 */
function sendImmediately(handle: string): void {
  const payload = JSON.stringify({
    handle,
    referrer: document.referrer || null,
    ts: Date.now(),
  });

  const blob = new Blob([payload], { type: "application/json" });

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(TRACK_ENDPOINT, blob);
    if (!sent) {
      flushQueue([{ handle, referrer: document.referrer || null, ts: Date.now() }]);
    }
  } else {
    flushQueue([{ handle, referrer: document.referrer || null, ts: Date.now() }]);
  }
}
