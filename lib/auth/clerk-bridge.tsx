import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/react";
import { useEffect, useMemo } from "react";
import type { SessionData } from "./client";

export type BrowserClerk = ReturnType<typeof useClerk>;

export interface ClerkSnapshot {
  clerk: BrowserClerk;
  data: SessionData | null;
  isPending: boolean;
}

interface ClerkBridgeProps {
  publishableKey: string;
  onChange: (snapshot: ClerkSnapshot) => void;
}

function SessionSync({ onChange }: Pick<ClerkBridgeProps, "onChange">) {
  const clerk = useClerk();
  const { user, isLoaded } = useUser();
  const { isSignedIn, sessionId } = useAuth();

  const data = useMemo<SessionData | null>(() => {
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

  useEffect(
    () => onChange({ clerk, data, isPending: !isLoaded }),
    [clerk, data, isLoaded, onChange],
  );

  // clerk-js failed to load (blocked or offline); SessionProvider's boundary reports it.
  if (clerk.status === "error") throw new Error("clerk-js failed to load");

  return null;
}

/** Mounts Clerk beside the app (its modals render in their own portal) and reports session changes. */
export default function ClerkBridge({ publishableKey, onChange }: ClerkBridgeProps) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SessionSync onChange={onChange} />
    </ClerkProvider>
  );
}
