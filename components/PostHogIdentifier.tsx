"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";

/**
 * Identifies authenticated users in PostHog on every page load.
 * Rendered in the root layout so identification persists across routes.
 * No PII is sent via capture() — identify() is the correct place for email/name.
 */
export function PostHogIdentifier() {
  const { data: session } = useSession();

  useEffect(() => {
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
