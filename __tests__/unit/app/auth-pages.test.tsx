import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VerifyEmailPage from "@/app/(public)/verify-email/page";
import ResetPasswordPage from "@/app/reset-password/page";

type AuthActionResult = {
  data: unknown | null;
  error: { message?: string } | null;
};

const mocks = vi.hoisted(() => ({
  search: "",
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  resetPassword: vi.fn(
    async (_params?: unknown): Promise<AuthActionResult> => ({
      data: {},
      error: null,
    }),
  ),
  sendVerificationEmail: vi.fn(
    async (_params?: unknown): Promise<AuthActionResult> => ({
      data: {},
      error: null,
    }),
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
  Toaster: () => null,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/lib/auth/client", () => ({
  resetPassword: (params: unknown) => mocks.resetPassword(params),
  sendVerificationEmail: (params: unknown) => mocks.sendVerificationEmail(params),
}));

vi.mock("@/components/auth/PasswordInput", () => ({
  PasswordInput: ({
    id,
    value,
    onChange,
    onStrengthChange,
    disabled,
  }: {
    id: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onStrengthChange?: (result: { isAcceptable: boolean } | null) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      type="password"
      value={value}
      disabled={disabled}
      onChange={(event) => {
        onChange(event);
        onStrengthChange?.({ isAcceptable: event.target.value.includes("Strong") });
      }}
    />
  ),
}));

describe("auth action pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders reset-password invalid, weak-password, success, and provider error states", async () => {
    const user = userEvent.setup();

    const invalid = render(<ResetPasswordPage />);
    expect(screen.getByText("Invalid Reset Link")).toBeInTheDocument();
    invalid.unmount();

    mocks.search = "token=reset_123";
    const { unmount } = render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText("New Password"), "WeakPass1!");
    await user.type(screen.getByLabelText("Confirm Password"), "WeakPass1!");
    fireEvent.submit(screen.getByRole("button", { name: "Reset Password" }).closest("form")!);
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Please choose a stronger password"),
    );
    unmount();

    mocks.resetPassword.mockResolvedValueOnce({ data: {}, error: null });
    render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText("New Password"), "StrongPass123!");
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass123!");
    fireEvent.submit(screen.getByRole("button", { name: "Reset Password" }).closest("form")!);
    expect(await screen.findByText("Password Reset Successfully")).toBeInTheDocument();
  });

  it("maps reset-password expired, password, generic, and thrown failures", async () => {
    const user = userEvent.setup();
    mocks.search = "token=reset_123";

    mocks.resetPassword.mockResolvedValueOnce({
      data: null,
      error: { message: "token expired" },
    });
    const expired = render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText("New Password"), "StrongPass123!");
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass123!");
    fireEvent.submit(screen.getByRole("button", { name: "Reset Password" }).closest("form")!);
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "This reset link has expired. Please request a new one.",
      ),
    );
    expired.unmount();

    mocks.resetPassword.mockResolvedValueOnce({
      data: null,
      error: { message: "password is too common" },
    });
    const password = render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText("New Password"), "StrongPass123!");
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass123!");
    fireEvent.submit(screen.getByRole("button", { name: "Reset Password" }).closest("form")!);
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Password does not meet requirements."),
    );
    password.unmount();

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.resetPassword.mockRejectedValueOnce(new Error("network"));
      render(<ResetPasswordPage />);
      await user.type(screen.getByLabelText("New Password"), "StrongPass123!");
      await user.type(screen.getByLabelText("Confirm Password"), "StrongPass123!");
      fireEvent.submit(screen.getByRole("button", { name: "Reset Password" }).closest("form")!);
      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Something went wrong. Please try again."),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("renders verify-email success, error, resend success, cooldown, and failures", async () => {
    const user = userEvent.setup();

    const success = render(<VerifyEmailPage />);
    expect(screen.getByText("Email Verified!")).toBeInTheDocument();
    success.unmount();

    mocks.search = "error=invalid_token&email=avery%40example.com";
    const invalid = render(<VerifyEmailPage />);
    expect(screen.getByText("Invalid Verification Link")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resend Verification Email" }));
    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "Verification email sent! Check your inbox.",
      ),
    );
    expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();
    invalid.unmount();

    mocks.search = "error=server_error";
    const generic = render(<VerifyEmailPage />);
    expect(screen.getByText("Verification Failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resend/ })).not.toBeInTheDocument();
    generic.unmount();

    mocks.search = "error=invalid_token&email=avery%40example.com";
    mocks.sendVerificationEmail.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });
    const failed = render(<VerifyEmailPage />);
    await user.click(screen.getByRole("button", { name: "Resend Verification Email" }));
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Rate limited"));
    failed.unmount();

    const errorSpy2 = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.sendVerificationEmail.mockRejectedValueOnce(new Error("network"));
      render(<VerifyEmailPage />);
      await user.click(screen.getByRole("button", { name: "Resend Verification Email" }));
      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Something went wrong. Please try again."),
      );
    } finally {
      errorSpy2.mockRestore();
    }
  });
});
