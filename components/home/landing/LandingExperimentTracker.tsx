"use client";

import { useEffect } from "react";
import {
  isAnalyticsInitialized,
  registerAnalyticsProperties,
  setAnalyticsPersonPropertiesOnce,
  trackAnalyticsEvent,
} from "@/lib/analytics/client";
import type { LandingVariant } from "@/lib/experiments/landing";

/**
 * Tags this browser with its landing variant (ADR-0027): a super property so
 * every later client event carries it, a set-once person property so server
 * events (claim, onboarding) can be broken down after identify(), and a
 * `landing_viewed` exposure event as the funnel's first step.
 */
export function LandingExperimentTracker({ variant }: { variant: LandingVariant }) {
  useEffect(() => {
    if (!isAnalyticsInitialized()) return;

    registerAnalyticsProperties({ landing_variant: variant });
    setAnalyticsPersonPropertiesOnce({ landing_variant: variant });
    trackAnalyticsEvent("landing_viewed", { landing_variant: variant });
  }, [variant]);

  return null;
}
