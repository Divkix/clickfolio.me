import type * as ReactModule from "react";
import type * as TanStackRouter from "@tanstack/react-router";
import type * as AuthClient from "@/lib/auth/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

type ProfileMatch = { loaderData?: { data: { profile: { id: string } } } };

type RouterStatus = "idle" | "pending";

interface AnalyticsState {
  profileId: string | undefined;
  status: RouterStatus;
  session: {
    data: AuthClient.SessionData | null;
    error: null;
    isPending: boolean;
    hasSessionHint: boolean;
  };
}

const mocks = vi.hoisted(() => {
  const effects: (() => void | (() => void))[] = [];
  const refs: ReactModule.RefObject<unknown>[] = [];

  const state: AnalyticsState = {
    profileId: undefined,
    status: "idle",
    session: {
      data: null,
      error: null,
      isPending: true,
      hasSessionHint: false,
    },
  };

  return {
    ...state,
    effects,
    refs,
    refIndex: 0,
    location: { href: "/", pathname: "/" },
    gtag: vi.fn<NonNullable<Window["gtag"]>>(),
  };
});

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  useEffect: (effect: () => void | (() => void)) => mocks.effects.push(effect),
  useRef: <T,>(initial: T) => {
    const index = mocks.refIndex++;

    if (!(index in mocks.refs)) mocks.refs[index] = { current: initial };

    // SAFETY: Each hook slot retains the type supplied by the same component across renders.
    return mocks.refs[index] as ReactModule.RefObject<T>;
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof TanStackRouter>()),
  useLocation: () => mocks.location,
  useRouterState: ({ select }: { select: (state: { status: RouterStatus }) => boolean }) =>
    select({ status: mocks.status }),
  useMatch: ({ select }: { select: (match: ProfileMatch) => string | undefined }) =>
    mocks.profileId === undefined
      ? undefined
      : select({ loaderData: { data: { profile: { id: mocks.profileId } } } }),
}));

vi.mock("@/lib/auth/client", async (importOriginal) => ({
  ...(await importOriginal<typeof AuthClient>()),
  useSession: () => mocks.session,
}));

function render() {
  mocks.refIndex = 0;
  mocks.effects = [];
  GoogleAnalytics();

  for (const effect of mocks.effects) effect();
}

function visit(href: string, title: string, profileId?: string) {
  mocks.location = { href, pathname: new URL(href, window.location.origin).pathname };
  mocks.profileId = profileId;
  document.title = title;
}

function signIn(userId: string) {
  mocks.session = {
    ...mocks.session,
    isPending: false,
    data: {
      user: { id: userId, name: "Avery", email: "avery@example.com", image: null },
      session: { id: "session_1" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refs = [];
  mocks.effects = [];
  mocks.refIndex = 0;
  mocks.location = { href: "/", pathname: "/" };
  mocks.profileId = undefined;
  mocks.status = "idle";
  mocks.session = { data: null, error: null, isPending: true, hasSessionHint: false };
  vi.stubGlobal("document", { cookie: "", title: "Home" });
  vi.stubGlobal("window", { location: { origin: "https://clickfolio.me" }, gtag: mocks.gtag });
});

afterEach(() => vi.unstubAllGlobals());

describe("manual GA4 page views", () => {
  it("counts the initial nonprofile page, navigation, query changes and revisits", () => {
    mocks.session.hasSessionHint = true;
    document.cookie = "__session=token";
    render();
    visit("/explore", "Explore");
    render();
    visit("/explore?sort=recent", "Recent portfolios");
    render();
    visit("/", "Home again");
    render();

    expect(mocks.gtag.mock.calls).toEqual([
      ["event", "page_view", { page_location: "https://clickfolio.me/", page_title: "Home" }],
      [
        "event",
        "page_view",
        { page_location: "https://clickfolio.me/explore", page_title: "Explore" },
      ],
      [
        "event",
        "page_view",
        {
          page_location: "https://clickfolio.me/explore?sort=recent",
          page_title: "Recent portfolios",
        },
      ],
      ["event", "page_view", { page_location: "https://clickfolio.me/", page_title: "Home again" }],
    ]);
  });

  it("does not resend a handled href on rerenders or session changes", () => {
    visit("/@avery", "Avery", "owner_1");
    render();
    render();
    signIn("visitor_1");
    render();
    mocks.session = { data: null, error: null, isPending: false, hasSessionHint: false };
    render();
    mocks.effects[0]!();

    expect(mocks.gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
      page_location: "https://clickfolio.me/@avery",
      page_title: "Avery",
    });
  });

  it.each(["other=1; __session=token", "__client_uat=1730000000"])(
    "waits for an owner session with cookie %s before the provider hint initializes",
    (cookie) => {
      visit("/@avery", "Avery", "owner_1");
      document.cookie = cookie;
      render();

      expect(mocks.gtag).not.toHaveBeenCalled();

      mocks.session.hasSessionHint = true;
      render();

      expect(mocks.gtag).not.toHaveBeenCalled();

      signIn("owner_1");
      render();

      expect(mocks.gtag).not.toHaveBeenCalled();
    },
  );

  it("waits for a hinted session, then counts a confirmed signed-in nonowner", () => {
    visit("/@avery", "Avery", "owner_1");
    mocks.session.hasSessionHint = true;
    render();
    render();

    expect(mocks.gtag).not.toHaveBeenCalled();

    signIn("visitor_1");
    render();
    render();

    expect(mocks.gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
      page_location: "https://clickfolio.me/@avery",
      page_title: "Avery",
    });
  });

  it("keeps an owner visit suppressed after sign-out until leaving and revisiting", () => {
    visit("/@avery", "Avery", "owner_1");
    signIn("owner_1");
    render();
    mocks.session = { data: null, error: null, isPending: false, hasSessionHint: false };
    render();

    expect(mocks.gtag).not.toHaveBeenCalled();

    visit("/", "Home");
    render();
    visit("/@avery", "Avery", "owner_1");
    render();

    expect(mocks.gtag).toHaveBeenCalledTimes(2);
    expect(mocks.gtag).toHaveBeenLastCalledWith("event", "page_view", {
      page_location: "https://clickfolio.me/@avery",
      page_title: "Avery",
    });
  });

  it.each(["", "__session=", "__client_uat=0", "__client_uat=", "other__session=token"])(
    "counts an anonymous pending profile promptly with cookies %s",
    (cookie) => {
      visit("/@avery", "Avery", "owner_1");
      document.cookie = cookie;
      render();

      expect(mocks.gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
        page_location: "https://clickfolio.me/@avery",
        page_title: "Avery",
      });
    },
  );

  it("counts a revisit after leaving a profile before its hinted session resolves", () => {
    render();
    visit("/@avery", "Avery", "owner_1");
    mocks.session.hasSessionHint = true;
    render();

    expect(mocks.gtag).toHaveBeenCalledOnce();

    visit("/", "Home again");
    render();

    expect(mocks.gtag).toHaveBeenCalledTimes(2);
    expect(mocks.gtag).toHaveBeenLastCalledWith("event", "page_view", {
      page_location: "https://clickfolio.me/",
      page_title: "Home again",
    });

    signIn("owner_1");
    render();

    expect(mocks.gtag).toHaveBeenCalledTimes(2);
  });

  it("waits for navigation to resolve before sending the new page and title", () => {
    render();
    mocks.status = "pending";
    mocks.location = { href: "/explore", pathname: "/explore" };
    render();

    expect(mocks.gtag).toHaveBeenCalledOnce();

    mocks.status = "idle";
    document.title = "Explore";
    render();

    expect(mocks.gtag).toHaveBeenCalledTimes(2);
    expect(mocks.gtag).toHaveBeenLastCalledWith("event", "page_view", {
      page_location: "https://clickfolio.me/explore",
      page_title: "Explore",
    });
  });

  it("is safe when the Google tag is unavailable", () => {
    delete window.gtag;

    expect(render).not.toThrow();
    expect(mocks.gtag).not.toHaveBeenCalled();
  });
});
