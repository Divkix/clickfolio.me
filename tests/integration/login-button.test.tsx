import type * as ReactModule from "react";
import type * as TanStackRouter from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const states: unknown[] = [];
  const effects: (() => void | (() => void))[] = [];

  return { states, stateIndex: 0, effects };
});

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  useState: <T,>(initial: T) => {
    const index = mocks.stateIndex++;

    if (!(index in mocks.states)) mocks.states[index] = initial;

    // SAFETY: Each hook slot only receives values from its matching state setter.
    return [mocks.states[index] as T, (value: T) => (mocks.states[index] = value)];
  },
  useEffect: (effect: () => void | (() => void)) => mocks.effects.push(effect),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>();

  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => "/",
    Link: ({ to, children, ...props }: { to: string } & ReactModule.ComponentProps<"a">) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/lib/telemetry/browser", () => ({ whenIdle: () => new Promise(() => {}) }));

import { LoginButton } from "@/components/auth/LoginButton";
import { SessionProvider } from "@/lib/auth/client";

function render() {
  mocks.stateIndex = 0;
  mocks.effects = [];

  return renderToStaticMarkup(
    <SessionProvider publishableKey="pk_test_unused">
      <LoginButton />
    </SessionProvider>,
  );
}

beforeEach(() => {
  mocks.states = [];
  vi.stubGlobal("document", { cookie: "" });
});

afterEach(() => vi.unstubAllGlobals());

describe("LoginButton session loading", () => {
  it.each([
    { cookie: "__session=token", signedIn: false, expected: "pending" },
    { cookie: "__client_uat=1730000000", signedIn: false, expected: "pending" },
    { cookie: "", signedIn: false, expected: "anonymous" },
    { cookie: "__client_uat=0", signedIn: false, expected: "anonymous" },
    { cookie: "__session=token", signedIn: true, expected: "dashboard" },
  ])("renders $expected with cookie '$cookie'", ({ cookie, signedIn, expected }) => {
    vi.stubGlobal("document", { cookie });
    render();
    mocks.effects[0]!();

    if (signedIn) {
      mocks.states[1] = {
        isPending: false,
        data: {
          user: { id: "user_1", name: "Alex", email: "alex@example.com", image: null },
          session: { id: "session_1" },
        },
      };
    }

    const html = render();

    if (expected === "pending") {
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('class="invisible"');
      expect(html).not.toContain("Sign in");
      expect(html).not.toContain("href=");
    } else if (expected === "dashboard") {
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain("Dashboard");
      expect(html).not.toContain("Sign in");
    } else {
      expect(html).toContain("Sign in");
      expect(html).not.toContain('disabled=""');
    }

    expect(html).toContain("w-28");
  });
});
