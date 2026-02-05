"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { captureReferralCode } from "@/lib/referral";

/**
 * Fire tracking beacon to record referral click
 * Uses sendBeacon for reliability (survives page navigation)
 */
async function trackReferralClick(
  code: string,
  source: "homepage" | "cta" | "share" = "homepage",
): Promise<void> {
  try {
    const payload = JSON.stringify({ code, source });

    // Prefer sendBeacon for reliability
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/referral/track", payload);
    } else {
      // Fallback to fetch
      await fetch("/api/referral/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    // Silent failure - tracking shouldn't break the page
  }
}

/**
 * Client component that captures ?ref= parameter from URL
 *
 * This is separated from the main page to allow Suspense boundary
 * during static page generation.
 *
 * Captures the referral code in localStorage and fires a tracking beacon.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();
  const hasTracked = useRef(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      captureReferralCode(ref);

      // Track the click only once per page load
      if (!hasTracked.current) {
        hasTracked.current = true;
        trackReferralClick(ref, "homepage");
      }
    }
  }, [searchParams]);

  // This component renders nothing - it's purely for side effects
  return null;
}
