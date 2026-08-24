"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { useUser } from "@/lib/auth/client";

/**
 * Identifies authenticated users in PostHog on every page load.
 * Rendered in the root layout so identification persists across routes.
 * No PII is sent via capture() — identify() is the correct place for email/name.
 * No-ops when PostHog was not initialized (missing project token).
 *
 * Identity key is the app user id: `externalId ?? id` keeps the pre-Clerk
 * D1/Postgres uuid for imported users, so historical funnels stay continuous.
 */
export function PostHogIdentifier() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    // __loaded is set by posthog-js after a successful init(); without a token
    // instrumentation-client skips init and identify/reset must not run.
    if (!posthog.__loaded || !isLoaded) return;

    if (user) {
      posthog.identify(user.externalId ?? user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    } else {
      posthog.reset();
    }
  }, [user, isLoaded]);

  return null;
}
