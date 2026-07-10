import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
  signUpEmail: vi.fn(),
  signInEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

const originalFetch = globalThis.fetch;

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("@/lib/auth/client", () => ({
  signUp: {
    email: (...args: unknown[]) => mocks.signUpEmail(...args),
  },
  signIn: {
    email: (...args: unknown[]) => mocks.signInEmail(...args),
  },
  requestPasswordReset: (...args: unknown[]) => mocks.requestPasswordReset(...args),
}));

vi.mock("@/components/auth/PasswordInput", () => ({
  PasswordInput: ({
    id,
    placeholder,
    value,
    onChange,
    onStrengthChange,
    disabled,
  }: {
    id?: string;
    placeholder?: string;
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onStrengthChange?: (result: {
      score: number;
      isAcceptable: boolean;
      crackTimeDisplay: string;
      crackTimeSeconds: number;
      feedback: { warning: string; suggestions: string[] };
    }) => void;
    disabled?: boolean;
  }) => (
    // eslint-disable-next-line jsx-a11y/control-has-associated-label -- test mock input, no label needed
    <input
      id={id}
      type="password"
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        onChange?.(event);
        onStrengthChange?.({
          score: 4,
          isAcceptable: true,
          crackTimeDisplay: "centuries",
          crackTimeSeconds: 999_999,
          feedback: { warning: "", suggestions: [] },
        });
      }}
    />
  ),
}));

async function fillSignUpForm() {
  await userEvent.type(screen.getByLabelText("Name"), "Avery Quinn");
  await userEvent.type(screen.getByLabelText("Email"), "avery@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "CorrectHorseBatteryStaple!2026");
}

describe("auth form flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () => Response.json({ valid: true })) as unknown as typeof fetch;
    mocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null });
    mocks.requestPasswordReset.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    if (originalFetch === undefined) {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
  });

  it("blocks sign up when disposable email validation returns a reason", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ valid: false, reason: "Please use a permanent email address" }),
    ) as unknown as typeof fetch;

    render(<SignUpForm />);
    await userEvent.type(screen.getByLabelText("Email"), "temp@example.com");
    screen.getByLabelText("Email").blur();

    await waitFor(() =>
      expect(screen.getByText("Please use a permanent email address")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
  });

  it("creates an account and redirects to the requested callback URL", async () => {
    const onSuccess = vi.fn();
    render(<SignUpForm callbackURL="/wizard?from=test" onSuccess={onSuccess} />);
    await fillSignUpForm();

    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mocks.signUpEmail).toHaveBeenCalledWith({
        name: "Avery Quinn",
        email: "avery@example.com",
        password: "CorrectHorseBatteryStaple!2026",
        callbackURL: "/wizard?from=test",
      }),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith(
      "Account created! Check your email to verify your address.",
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(mocks.router.push).toHaveBeenCalledWith("/wizard?from=test");
  });

  it("maps sign up provider errors to user-facing toast messages", async () => {
    const cases = [
      ["email already exists", "An account with this email already exists"],
      ["password too weak", "Password does not meet requirements"],
      ["use a permanent email", "Please use a permanent email address to sign up"],
      ["server unavailable", "server unavailable"],
    ] as const;

    for (const [providerMessage, toastMessage] of cases) {
      mocks.signUpEmail.mockResolvedValueOnce({ data: null, error: { message: providerMessage } });
      const { unmount } = render(<SignUpForm />);
      await fillSignUpForm();
      await userEvent.click(screen.getByRole("button", { name: /create account/i }));
      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(toastMessage));
      unmount();
      mocks.toast.error.mockClear();
    }
  });

  it("signs in, handles credential errors, and exposes forgot-password navigation", async () => {
    const onSuccess = vi.fn();
    const onForgotPassword = vi.fn();
    const { unmount } = render(
      <SignInForm
        callbackURL="/dashboard?welcome=1"
        onSuccess={onSuccess}
        onForgotPassword={onForgotPassword}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(onForgotPassword).toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Email"), "avery@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mocks.signInEmail).toHaveBeenCalledWith({
        email: "avery@example.com",
        password: "password123",
        callbackURL: "/dashboard?welcome=1",
      }),
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard?welcome=1");
    unmount();

    mocks.signInEmail.mockResolvedValueOnce({
      data: null,
      error: { message: "invalid credentials" },
    });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText("Email"), "avery@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Invalid email or password"),
    );
  });

  it("requests password reset and shows the non-enumerating success state", async () => {
    const onBack = vi.fn();
    render(<ForgotPasswordForm onBackToSignIn={onBack} />);
    await userEvent.type(screen.getByLabelText("Email"), "avery@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
        email: "avery@example.com",
        redirectTo: "/reset-password",
      }),
    );
    expect(screen.getByText("Check your email")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
