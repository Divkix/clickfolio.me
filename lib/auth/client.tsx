/**
 * Client-side Clerk authentication seam for Clickfolio.
 *
 * Two things live here:
 *
 *  1. Native Clerk re-exports — new code should import these directly.
 *  2. A minimal `useSession()` adapter matching the shape consumed by
 *     existing non-auth client components (FileDropzone, OwnerDetector,
 *     CreateYoursCTA, wizard, Sidebar, admin layout).
 *
 * Sign-in / sign-up UI is Clerk's prebuilt <SignIn>/<SignUp> components; there
 * is no custom credential or OAuth submission logic anywhere in the app.
 */

"use client";

import { ClerkProvider, SignInButton, useAuth, useClerk, useUser } from "@clerk/react";
import { useMemo } from "react";

export { ClerkProvider, SignInButton, useAuth, useClerk, useUser };

/** User block of the session adapter. */
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

/**
 * Minimal session adapter for existing consumers.
 *
 * `user.id` is the APP identity: for imported users Clerk's `externalId`
 * carries the legacy Postgres user id, and new users use their Clerk id as the
 * Postgres PK — so `externalId ?? id` is always the id the app keys on
 * (analytics ownership checks, PostHog identity continuity). `session.userId`
 * remains the raw Clerk id.
 */
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
