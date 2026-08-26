"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/auth/client";
import {
  identifyAnalyticsUser,
  isAnalyticsInitialized,
  resetAnalyticsIdentity,
} from "@/lib/analytics/client";

/**
 * Identifies authenticated users in PostHog on every page load.
 * Rendered in the root layout so identification persists across routes.
 * No PII is sent via trackAnalyticsEvent() — identify() is the correct place
 * for email/name.
 * No-ops when PostHog was not initialized (missing project token).
 *
 * Identity key is the app user id: `externalId ?? id` keeps the pre-Clerk
 * D1/Postgres uuid for imported users, so historical funnels stay continuous.
 */
export function PostHogIdentifier() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    // Without a token, instrumentation-client skips init and identify/reset
    // must not run against an uninitialized instance.
    if (!isAnalyticsInitialized() || !isLoaded) return;

    if (user) {
      // Only set present traits — posthog previously received undefined for
      // missing email/name and dropped them during serialization.
      const traits: Record<string, string> = {};
      if (user.primaryEmailAddress?.emailAddress) {
        traits.email = user.primaryEmailAddress.emailAddress;
      }
      if (user.fullName) {
        traits.name = user.fullName;
      }
      identifyAnalyticsUser(user.externalId ?? user.id, traits);
    } else {
      resetAnalyticsIdentity();
    }
  }, [user, isLoaded]);

  return null;
}
