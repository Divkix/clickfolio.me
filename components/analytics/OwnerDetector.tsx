"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";

interface OwnerDetectorProps {
  profileId: string;
}

export function OwnerDetector({ profileId }: OwnerDetectorProps) {
  const { data: session } = useSession();

  useEffect(() => {
    // SSR guard: window is undefined during server rendering of this layout.
    if (typeof window === "undefined") return;

    // Assign the boolean explicitly so non-owners clear the flag instead of
    // leaving a stale `true` from a previous profile (which would suppress
    // analytics for other users' pages for the whole session).
    window.__clickfolioOwner = session?.user?.id === profileId;

    // Clear on unmount so the flag never leaks across page navigations.
    return () => {
      window.__clickfolioOwner = undefined;
    };
  }, [session, profileId]);

  return null;
}
