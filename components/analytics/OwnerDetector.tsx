"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";

interface OwnerDetectorProps {
  profileId: string;
}

type ClickfolioWindow = Window & { __clickfolioOwner?: boolean };

export function OwnerDetector({ profileId }: OwnerDetectorProps) {
  const { data: session } = useSession();

  useEffect(() => {
    // SSR guard: window is undefined during server rendering of this layout.
    if (globalThis.window === undefined) return;

    // Assign the boolean explicitly so non-owners clear the flag instead of
    // leaving a stale `true` from a previous profile (which would suppress
    // analytics for other users' pages for the whole session).
    // SAFETY: window.__clickfolioOwner is our owner flag set by OwnerDetector, single cast bridges missing type.
    (globalThis.window as ClickfolioWindow).__clickfolioOwner = session?.user?.id === profileId;

    // Clear on unmount so the flag never leaks across page navigations.
    return () => {
      // SAFETY: window.__clickfolioOwner is our owner flag set by OwnerDetector, single cast bridges missing type.
      (globalThis.window as ClickfolioWindow).__clickfolioOwner = undefined;
    };
  }, [session, profileId]);

  return null;
}
