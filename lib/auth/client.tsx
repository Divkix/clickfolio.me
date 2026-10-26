import { Slot } from "@radix-ui/react-slot";
import { CatchBoundary, useNavigate } from "@tanstack/react-router";
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { whenIdle } from "@/lib/telemetry/browser";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";
import type { BrowserClerk, ClerkSnapshot } from "./clerk-bridge";

export interface ClientSessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface SessionData {
  user: ClientSessionUser;
  session: { id: string | null; userId: string };
}

interface UseSessionResult {
  data: SessionData | null;
  error: null;
  isPending: boolean;
}

interface SessionContextValue extends UseSessionResult {
  /** Resolves once Clerk has loaded, loading it now if the idle callback has not yet. */
  getClerk: () => Promise<BrowserClerk>;
}

// `@clerk/react` is ~35 KB gzip; loading it once the page is idle keeps it off the first paint.
const ClerkBridge = lazy(() => import("./clerk-bridge"));

// sonner stays out of the entry chunk; it only loads when a click finds Clerk unavailable.
function notifyClerkUnavailable(): void {
  void import("sonner").then(({ toast }) =>
    toast.error("Sign-in couldn't load. Reload the page and try again.", {
      id: "clerk-unavailable",
    }),
  );
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  publishableKey,
  children,
}: Readonly<{ publishableKey: string; children: ReactNode }>) {
  const [loadClerk, setLoadClerk] = useState(false);
  const [snapshot, setSnapshot] = useState<ClerkSnapshot | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const waiting = useRef<PromiseWithResolvers<BrowserClerk>[]>([]);

  useEffect(() => {
    void whenIdle().then(() => setLoadClerk(true));
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.isPending) return;

    for (const { resolve } of waiting.current.splice(0)) resolve(snapshot.clerk);
  }, [snapshot]);

  const getClerk = useCallback((): Promise<BrowserClerk> => {
    if (snapshot && !snapshot.isPending) return Promise.resolve(snapshot.clerk);

    if (loadError !== null) return Promise.reject(loadError);

    setLoadClerk(true);

    const waiter = Promise.withResolvers<BrowserClerk>();

    waiting.current.push(waiter);

    return waiter.promise;
  }, [snapshot, loadError]);

  const value = useMemo<SessionContextValue>(
    () => ({
      data: snapshot?.data ?? null,
      error: null,
      isPending: snapshot?.isPending ?? true,
      getClerk,
    }),
    [snapshot, getClerk],
  );

  return (
    <SessionContext value={value}>
      {children}
      {loadClerk && (
        <CatchBoundary
          getResetKey={() => publishableKey}
          errorComponent={() => null}
          onCatch={(error) => {
            log("error", "Clerk failed to load", { ...errorFields(error) });
            setLoadError(error);

            for (const { reject } of waiting.current.splice(0)) reject(error);
          }}
        >
          <Suspense>
            <ClerkBridge publishableKey={publishableKey} onChange={setSnapshot} />
          </Suspense>
        </CatchBoundary>
      )}
    </SessionContext>
  );
}

function useSessionContext(): SessionContextValue {
  const value = useContext(SessionContext);

  if (!value) throw new Error("useSession needs a SessionProvider above it");

  return value;
}

export function useSession(): UseSessionResult {
  return useSessionContext();
}

/**
 * Opens Clerk's sign-in modal; a click before Clerk has loaded waits for it. Clerk won't open
 * sign-in over an existing session, so a signed-in visitor goes straight to the redirect. If
 * Clerk failed to load, the click shows a toast asking for a reload.
 *
 * `isPending` stays true until Clerk loads (idle time or this click), so never disable the child
 * on it: the click is what loads Clerk early.
 */
export function SignInButton({
  fallbackRedirectUrl,
  children,
}: Readonly<{ fallbackRedirectUrl: string; children: ReactElement }>) {
  const { getClerk } = useSessionContext();
  const navigate = useNavigate();

  return (
    <Slot
      onClick={() =>
        void getClerk().then(
          (clerk) =>
            clerk.user
              ? navigate({ href: fallbackRedirectUrl })
              : clerk.openSignIn({ fallbackRedirectUrl }),
          notifyClerkUnavailable,
        )
      }
    >
      {children}
    </Slot>
  );
}

export function useSignOut(): () => Promise<void> {
  const { getClerk } = useSessionContext();

  return useCallback(
    () =>
      getClerk().then(
        (clerk) => clerk.signOut(),
        (error) => {
          notifyClerkUnavailable();

          throw error;
        },
      ),
    [getClerk],
  );
}
