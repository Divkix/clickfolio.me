import { Slot } from "@radix-ui/react-slot";
import { CatchBoundary, useLocation, useNavigate } from "@tanstack/react-router";
import {
  cloneElement,
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
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

// Public anonymous visits keep Clerk out of the network until an auth action needs it.
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
  const pathname = useLocation({ select: (location) => location.pathname });
  const [loadClerk, setLoadClerk] = useState(false);
  const [snapshot, setSnapshot] = useState<ClerkSnapshot | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const waiting = useRef<PromiseWithResolvers<BrowserClerk>[]>([]);

  useEffect(() => {
    const hasSession = document.cookie.split(";").some((cookie) => {
      const [name, value] = cookie.trim().split("=");

      return (
        (name === "__session" && Boolean(value)) ||
        (name === "__client_uat" && Boolean(value) && value !== "0")
      );
    });

    // /themes is also protected; claiming an uploaded resume happens in /waiting.
    const needsAuth = /^\/(dashboard|edit|settings|wizard|waiting|themes|admin|preview)(\/|$)/.test(
      pathname,
    );

    if (!hasSession && !needsAuth) return;

    let active = true;

    void whenIdle().then(() => {
      if (active) setLoadClerk(true);
    });

    return () => {
      active = false;
    };
  }, [pathname]);

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
 * Loads Clerk on demand with immediate button feedback. Both account flows return to the
 * requested page, including when the visitor switches between sign-up and sign-in.
 */
export function SignInButton({
  fallbackRedirectUrl,
  mode = "sign-in",
  onBeforeOpen,
  children,
}: Readonly<{
  fallbackRedirectUrl: string;
  mode?: "sign-in" | "sign-up";
  onBeforeOpen?: () => void;
  children: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
}>) {
  const { getClerk } = useSessionContext();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);

  return (
    <Slot
      onClick={async () => {
        if (openingRef.current) return;

        openingRef.current = true;
        setOpening(true);

        try {
          const clerk = await getClerk();

          if (clerk.user) {
            await navigate({ href: fallbackRedirectUrl });

            return;
          }

          onBeforeOpen?.();

          if (mode === "sign-up") {
            clerk.openSignUp({
              forceRedirectUrl: fallbackRedirectUrl,
              signInForceRedirectUrl: fallbackRedirectUrl,
            });
          } else {
            clerk.openSignIn({
              forceRedirectUrl: fallbackRedirectUrl,
              signUpForceRedirectUrl: fallbackRedirectUrl,
            });
          }
        } catch {
          notifyClerkUnavailable();
        } finally {
          openingRef.current = false;
          setOpening(false);
        }
      }}
    >
      {opening
        ? cloneElement(children, { disabled: true, "aria-busy": true, children: "Loading…" })
        : children}
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
