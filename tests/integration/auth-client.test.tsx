import type * as ReactModule from "react";
import type * as TanStackRouter from "@tanstack/react-router";
import { createElement, type ButtonHTMLAttributes, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { SignInButton } from "@/lib/auth/client";

const mocks = vi.hoisted(() => ({
  getClerk: vi.fn(),
  navigate: vi.fn(),
  openSignIn: vi.fn(),
  openSignUp: vi.fn(),
  toastError: vi.fn(),
  opening: false,
  openingRef: { current: false },
  setOpening: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  useContext: () => ({ getClerk: mocks.getClerk }),
  useState: () => [mocks.opening, mocks.setOpening],
  useRef: () => mocks.openingRef,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof TanStackRouter>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

type AuthButton = ReactElement<{
  onClick: () => Promise<void>;
  children: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
}>;

function button(options: { mode?: "sign-up"; onBeforeOpen?: () => void } = {}): AuthButton {
  return SignInButton({
    fallbackRedirectUrl: "/wizard",
    ...options,
    children: createElement("button", { type: "button" }, "Sign up to publish"),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.opening = false;
  mocks.openingRef.current = false;
  mocks.setOpening.mockImplementation((opening: boolean) => {
    mocks.opening = opening;
  });
  mocks.getClerk.mockResolvedValue({
    user: null,
    openSignIn: mocks.openSignIn,
    openSignUp: mocks.openSignUp,
  });
});

afterEach(() => vi.restoreAllMocks());

describe("auth button", () => {
  it("shows pending feedback immediately, suppresses repeat clicks, then opens sign-up after the upload closes", async () => {
    const loading = Promise.withResolvers<{
      user: null;
      openSignUp: typeof mocks.openSignUp;
    }>();

    mocks.getClerk.mockReturnValue(loading.promise);
    const beforeOpen = vi.fn();
    const original = button({ mode: "sign-up", onBeforeOpen: beforeOpen });
    const pending = original.props.onClick();

    const busy = button({ mode: "sign-up", onBeforeOpen: beforeOpen });
    expect(busy.props.children.props).toMatchObject({
      disabled: true,
      "aria-busy": true,
      children: "Loading…",
    });
    await busy.props.onClick();
    expect(mocks.getClerk).toHaveBeenCalledOnce();
    expect(beforeOpen).not.toHaveBeenCalled();

    loading.resolve({ user: null, openSignUp: mocks.openSignUp });
    await pending;

    expect(beforeOpen).toHaveBeenCalledOnce();
    expect(beforeOpen.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.openSignUp.mock.invocationCallOrder[0]!,
    );
    expect(mocks.openSignUp).toHaveBeenCalledWith({
      forceRedirectUrl: "/wizard",
      signInForceRedirectUrl: "/wizard",
    });
    expect(mocks.opening).toBe(false);
  });

  it("keeps sign-in and its sign-up link on the requested destination", async () => {
    await button().props.onClick();

    expect(mocks.openSignIn).toHaveBeenCalledWith({
      forceRedirectUrl: "/wizard",
      signUpForceRedirectUrl: "/wizard",
    });
    expect(mocks.openSignUp).not.toHaveBeenCalled();
  });

  it("restores the button and explains a Clerk loading failure without closing the upload", async () => {
    mocks.getClerk.mockRejectedValue(new Error("offline"));
    const beforeOpen = vi.fn();

    await button({ mode: "sign-up", onBeforeOpen: beforeOpen }).props.onClick();

    expect(mocks.opening).toBe(false);
    expect(beforeOpen).not.toHaveBeenCalled();
    expect(mocks.openSignUp).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
  });

  it("continues an existing session without opening another auth modal", async () => {
    mocks.getClerk.mockResolvedValue({ user: { id: "clerk_1" } });

    await button({ mode: "sign-up" }).props.onClick();

    expect(mocks.navigate).toHaveBeenCalledWith({ href: "/wizard" });
    expect(mocks.openSignUp).not.toHaveBeenCalled();
    expect(mocks.opening).toBe(false);
  });
});
