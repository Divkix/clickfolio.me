import type * as ReactModule from "react";
import type * as TanStackRouter from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import ClerkBridge, { type ClerkSnapshot } from "@/lib/auth/clerk-bridge";
import { SessionProvider } from "@/lib/auth/client";

const mocks = vi.hoisted(() => {
  const effects: (() => void | (() => void))[] = [];

  return {
    pathname: "/",
    effects,
    setState: vi.fn(),
    setSessionHint: vi.fn(),
    stateIndex: 0,
    whenIdle: vi.fn<() => Promise<void>>(),
    externalId: vi.fn<() => string | null>(),
  };
});

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  useState: <T,>(initial: T) => [
    initial,
    mocks.stateIndex++ === 3 ? mocks.setSessionHint : mocks.setState,
  ],
  useRef: () => ({ current: [] }),
  useMemo: <T,>(factory: () => T) => factory(),
  useCallback: <T,>(callback: T) => callback,
  useEffect: (effect: () => void | (() => void)) => mocks.effects.push(effect),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof TanStackRouter>()),
  useLocation: () => mocks.pathname,
}));

vi.mock("@/lib/telemetry/browser", () => ({ whenIdle: mocks.whenIdle }));

vi.mock("@clerk/react", () => ({
  ClerkProvider: ({ children }: { children: ReactModule.ReactNode }) => children,
  useClerk: () => ({ status: "ready" }),
  useAuth: () => ({ isSignedIn: true, sessionId: "session_1" }),
  useUser: () => ({
    isLoaded: true,
    user: {
      id: "clerk_1",
      externalId: mocks.externalId(),
      fullName: "Avery",
      primaryEmailAddress: { emailAddress: "avery@example.com" },
      imageUrl: null,
    },
  }),
}));

function mount() {
  SessionProvider({ publishableKey: "pk_test", children: null });

  return mocks.effects[0]!();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.pathname = "/";
  mocks.effects = [];
  mocks.stateIndex = 0;
  mocks.whenIdle.mockResolvedValue();
  vi.stubGlobal("document", { cookie: "" });
});

afterEach(() => vi.unstubAllGlobals());

describe("session provider idle loading", () => {
  it.each(["", "__client_uat=0", "other__session=token", "__session=", "__client_uat="])(
    "does not load Clerk for an anonymous public visit with cookies %s",
    async (cookie) => {
      vi.stubGlobal("document", { cookie });
      mount();
      await Promise.resolve();

      expect(mocks.whenIdle).not.toHaveBeenCalled();
      expect(mocks.setState).not.toHaveBeenCalled();
    },
  );

  it.each([
    "__client_uat=1730000000",
    "other=1; __session=token",
    "__client_uat=0; __session=token",
  ])("loads an existing session without a click with cookies %s", async (cookie) => {
    vi.stubGlobal("document", { cookie });
    mount();
    await Promise.resolve();

    expect(mocks.whenIdle).toHaveBeenCalledOnce();
    expect(mocks.setState).toHaveBeenCalledWith(true);
  });

  it.each([
    "/dashboard",
    "/edit",
    "/settings",
    "/wizard",
    "/waiting",
    "/themes",
    "/admin",
    "/admin/users",
    "/preview/glass",
  ])("loads Clerk on the auth route %s without cookies", async (pathname) => {
    mocks.pathname = pathname;
    mount();
    await Promise.resolve();

    expect(mocks.setState).toHaveBeenCalledWith(true);
  });

  it.each(["/", "/explore", "/templates", "/@someone", "/dashboard-other"])(
    "keeps anonymous public route %s free of Clerk idle work",
    (pathname) => {
      mocks.pathname = pathname;
      mount();

      expect(mocks.whenIdle).not.toHaveBeenCalled();
    },
  );

  it("cancels pending idle loading when leaving an auth route", async () => {
    mocks.pathname = "/waiting";
    const cleanup = mount();
    cleanup?.();
    await Promise.resolve();

    expect(mocks.setState).not.toHaveBeenCalled();
  });
});

describe("client session identity", () => {
  it.each(["legacy_1", null])("exposes only the app user id with externalId %s", (externalId) => {
    mocks.externalId.mockReturnValue(externalId);
    const onChange = vi.fn<(snapshot: ClerkSnapshot) => void>();

    renderToStaticMarkup(<ClerkBridge publishableKey="pk_test" onChange={onChange} />);
    mocks.effects[0]!();

    expect(onChange.mock.calls[0]![0].data).toEqual({
      user: {
        id: externalId ?? "clerk_1",
        name: "Avery",
        email: "avery@example.com",
        image: null,
      },
      session: { id: "session_1" },
    });
  });
});
