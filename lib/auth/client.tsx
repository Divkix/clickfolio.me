"use client";

import { ClerkProvider, SignInButton, useAuth, useClerk, useUser } from "@clerk/react";
import { useMemo } from "react";

export { ClerkProvider, SignInButton, useClerk, useUser };

export interface ClientSessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface UseSessionResult {
  data: { user: ClientSessionUser; session: { id: string | null; userId: string } } | null;
  error: null;
  isPending: boolean;
}

export function useSession(): UseSessionResult {
  const { user, isLoaded } = useUser();
  const { isSignedIn, sessionId } = useAuth();

  const data = useMemo<UseSessionResult["data"]>(() => {
    if (!isSignedIn || !user) return null;
    return {
      user: {
        id: user.externalId ?? user.id,
        name: user.fullName,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        image: user.imageUrl,
      },
      session: {
        id: sessionId ?? null,
        userId: user.id,
      },
    };
  }, [isSignedIn, sessionId, user]);

  return { data, error: null, isPending: !isLoaded };
}
