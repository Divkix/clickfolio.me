"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";

/**
 * Identifies authenticated users in PostHog on every page load.
 * Rendered in the root layout so identification persists across routes.
 * No PII is sent via capture() — identify() is the correct place for email/name.
 * No-ops when PostHog was not initialized (missing project token).
 */
export function PostHogIdentifier() {
  const { data: session } = useSession();

  useEffect(() => {
    // __loaded is set by posthog-js after a successful init(); without a token
    // instrumentation-client skips init and identify/reset must not run.
    if (!posthog.__loaded) return;

    if (session?.user) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      });
    } else if (session === null) {
      posthog.reset();
    }
  }, [session]);

  return null;
}
