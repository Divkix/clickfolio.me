"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";

interface OwnerDetectorProps {
  profileId: string;
}

export function OwnerDetector({ profileId }: OwnerDetectorProps) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.id === profileId) {
      window.__clickfolioOwner = true;
    }
  }, [session, profileId]);

  return null;
}
