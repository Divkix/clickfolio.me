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
    if (globalThis.window === undefined) return;

    // leaving a stale `true` from a previous profile (which would suppress
    // SAFETY: window.__clickfolioOwner is our owner flag set by OwnerDetector, single cast bridges missing type.
    (globalThis.window as ClickfolioWindow).__clickfolioOwner = session?.user?.id === profileId;

    return () => {
      // SAFETY: window.__clickfolioOwner is our owner flag set by OwnerDetector, single cast bridges missing type.
      (globalThis.window as ClickfolioWindow).__clickfolioOwner = undefined;
    };
  }, [session, profileId]);

  return null;
}
