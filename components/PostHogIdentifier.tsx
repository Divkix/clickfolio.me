"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/auth/client";
import {
  identifyAnalyticsUser,
  isAnalyticsInitialized,
  resetAnalyticsIdentity,
} from "@/lib/analytics/client";

export function PostHogIdentifier() {
  const { user, isLoaded } = useUser();

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
    } else {
      resetAnalyticsIdentity();
    }
  }, [user, isLoaded]);

  return null;
}
