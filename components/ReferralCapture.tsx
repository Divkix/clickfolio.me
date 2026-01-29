"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { captureReferralHandle } from "@/lib/referral";

/**
 * Client component that captures ?ref= parameter from URL
 *
 * This is separated from the main page to allow Suspense boundary
 * during static page generation.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const refHandle = searchParams.get("ref");
    if (refHandle) {
      captureReferralHandle(refHandle);
    }
  }, [searchParams]);

  // This component renders nothing - it's purely for side effects
  return null;
}
