"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/lib/auth/client";
import {
  identifyAnalyticsUser,
  isAnalyticsInitialized,
  resetAnalyticsIdentity,
} from "@/lib/analytics/client";

export function PostHogIdentifier() {
  const { user, isLoaded } = useUser();
  // Reset only on a signed-in → signed-out transition (logout). Resetting on
  // every anonymous page load would mint a fresh anonymous distinct_id each
  // time, splitting one visitor into many persons and breaking funnels.
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!isAnalyticsInitialized() || !isLoaded) return;

    if (user) {
      const traits: Record<string, string> = {};

      if (user.primaryEmailAddress?.emailAddress) {
        traits.email = user.primaryEmailAddress.emailAddress;
      }

      if (user.fullName) {
        traits.name = user.fullName;
      }

      identifyAnalyticsUser(user.externalId ?? user.id, traits);
      wasSignedIn.current = true;
    } else if (wasSignedIn.current) {
      resetAnalyticsIdentity();
      wasSignedIn.current = false;
    }
  }, [user, isLoaded]);

  return null;
}
