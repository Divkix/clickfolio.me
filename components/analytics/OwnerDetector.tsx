"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";

export function OwnerDetector({ profileId }: { profileId: string }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.id === profileId) {
      (window as unknown as Record<string, unknown>).__clickfolioOwner = true;
    }
  }, [session, profileId]);

  return null;
}
