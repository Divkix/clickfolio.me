import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { MilestoneToasts } from "@/components/dashboard/MilestoneToasts";
import { ReferralStats } from "@/components/dashboard/ReferralStats";
import { EditResumeFormWrapper } from "@/components/forms/EditResumeFormWrapper";
import { HandleForm } from "@/components/forms/HandleForm";
import { ShareBar } from "@/components/ShareBar";
import { TemplatePreviewModal } from "@/components/templates/TemplatePreviewModal";
import { CommaArrayInput } from "@/components/ui/comma-array-input";
import { SaveIndicator } from "@/components/ui/save-indicator";
import { YouAreLiveModal } from "@/components/YouAreLiveModal";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import type { ThemeId } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";

const mocks = vi.hoisted(() => ({
  router: {
    refresh: vi.fn(),
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
  copyToClipboard: vi.fn(),
  sendVerificationEmail: vi.fn(),
  checkBreached: vi.fn(),
  checkPasswordStrength: vi.fn(),
  signInSocial: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/lib/utils/clipboard", () => ({
  copyToClipboard: (...args: unknown[]) => mocks.copyToClipboard(...args),
}));

vi.mock("@/lib/auth/client", () => ({
  sendVerificationEmail: (...args: unknown[]) => mocks.sendVerificationEmail(...args),
  signIn: {
    social: (...args: unknown[]) => mocks.signInSocial(...args),
  },
}));

vi.mock("@/lib/password/hibp", () => ({
  checkBreached: (...args: unknown[]) => mocks.checkBreached(...args),
}));

vi.mock("@/lib/password/strength", () => ({
  checkPasswordStrength: (...args: unknown[]) => mocks.checkPasswordStrength(...args),
}));

vi.mock("@/lib/templates/theme-registry.client", () => ({
  DYNAMIC_TEMPLATES: Object.fromEntries(
    [
      "bento",
      "bold_corporate",
      "classic_ats",
      "design_folio",
      "dev_terminal",
      "glass",
      "midnight",
      "minimalist_editorial",
      "neo_brutalist",
      "spotlight",
    ].map((themeId) => [
      themeId,
      ({ content, profile }: { content: { full_name?: string }; profile: { handle: string } }) => (
        <article data-testid={`template-${themeId}`}>
          {content.full_name} {profile.handle}
        </article>
      ),
    ]),
  ) as Record<ThemeId, React.ComponentType<unknown>>,
}));

vi.mock("@/components/forms/EditResumeForm", () => ({
  EditResumeForm: ({
    initialData,
    onSave,
  }: {
    initialData: ResumeContent;
    onSave: (data: ResumeContent, isAutoSave?: boolean) => Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={() => onSave(initialData, false).catch(() => undefined)}>
        Publish Changes
      </button>
      <button type="button" onClick={() => onSave(initialData, true).catch(() => undefined)}>
        Autosave
      </button>
    </div>
  ),
}));

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

const resumeContent: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Staff Product Engineer",
  summary: "Builds resilient products.",
  contact: {
    email: "avery@example.com",
    location: "Phoenix, AZ",
  },
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
};

const originalFetch = global.fetch;
const originalWindowOpen = window.open;
const originalNavigatorDescriptors = {
  canShare: Object.getOwnPropertyDescriptor(navigator, "canShare"),
  share: Object.getOwnPropertyDescriptor(navigator, "share"),
};

function restoreNavigatorProperty(property: "canShare" | "share") {
  const descriptor = originalNavigatorDescriptors[property];
  if (descriptor) {
    Object.defineProperty(navigator, property, descriptor);
    return;
  }
  Reflect.deleteProperty(navigator, property);
}

describe("branch-heavy component interactions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    mocks.copyToClipboard.mockResolvedValue(true);
    mocks.sendVerificationEmail.mockResolvedValue({ data: {}, error: null });
    mocks.checkBreached.mockResolvedValue({ isBreached: false, count: 0 });
    mocks.checkPasswordStrength.mockResolvedValue({
      score: 4,
      isAcceptable: true,
      crackTimeDisplay: "centuries",
      crackTimeSeconds: 31_536_000_000,
      feedback: { warning: "", suggestions: [] },
    });
    mocks.signInSocial.mockResolvedValue({ data: {}, error: null });
    global.fetch = vi.fn(async () =>
      Response.json({ handle: "new-handle" }, { status: 200 }),
    ) as unknown as typeof fetch;
    window.open = vi.fn();
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn(() => true),
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: vi.fn(async () => undefined),
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    window.open = originalWindowOpen;
    restoreNavigatorProperty("canShare");
    restoreNavigatorProperty("share");
  });

  describe("HandleForm", () => {
    it("copies the public URL and resets the copied state", async () => {
      render(<HandleForm currentHandle="avery" />);

      fireEvent.click(screen.getByRole("button", { name: "Copy public URL" }));

      await waitFor(() =>
        expect(mocks.copyToClipboard).toHaveBeenCalledWith("https://clickfolio.me/@avery"),
      );
      expect(mocks.toast.success).toHaveBeenCalledWith("URL copied to clipboard");
    });

    it("reports copy failures and avoids saving an unchanged compact handle", async () => {
      mocks.copyToClipboard.mockResolvedValueOnce(false);

      render(<HandleForm currentHandle="avery" variant="compact" />);

      fireEvent.click(screen.getByRole("button", { name: "Copy public URL" }));
      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Failed to copy URL"));

      fireEvent.submit(screen.getByLabelText("Change Handle").closest("form") as HTMLFormElement);
      await waitFor(() =>
        expect(mocks.toast.info).toHaveBeenCalledWith("Handle is already set to this value"),
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("updates a changed handle, refreshes the route, and reports API failures", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<HandleForm currentHandle="avery" />);

      await user.clear(screen.getByLabelText("Change Handle"));
      await user.type(screen.getByLabelText("Change Handle"), "new-handle");
      expect(screen.getByText("https://clickfolio.me/@new-handle")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Update Handle" }));

      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          "/api/profile/handle",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ handle: "new-handle" }),
          }),
        ),
      );
      expect(mocks.toast.success).toHaveBeenCalledWith("Handle updated successfully!");
      expect(mocks.router.refresh).toHaveBeenCalled();

      vi.mocked(fetch).mockResolvedValueOnce(
        Response.json({ message: "Handle is taken" }, { status: 409 }),
      );
      rerender(<HandleForm currentHandle="avery" />);

      await user.clear(screen.getByLabelText("Change Handle"));
      await user.type(screen.getByLabelText("Change Handle"), "taken-handle");
      await user.click(screen.getByRole("button", { name: "Update Handle" }));

      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Handle is taken"));
    });

    it("shows validation errors and reports thrown update failures", async () => {
      const user = userEvent.setup();
      render(<HandleForm currentHandle="avery" variant="compact" />);

      await user.clear(screen.getByLabelText("Change Handle"));
      await user.type(screen.getByLabelText("Change Handle"), "Nope!");
      await user.click(screen.getByRole("button", { name: "Update" }));

      expect(
        await screen.findByText("Handle can only contain lowercase letters, numbers, and hyphens"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();

      vi.mocked(fetch).mockRejectedValueOnce("network");
      await user.clear(screen.getByLabelText("Change Handle"));
      await user.type(screen.getByLabelText("Change Handle"), "new-handle");
      await user.click(screen.getByRole("button", { name: "Update" }));

      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Failed to update handle"),
      );
    });
  });

  describe("EmailVerificationBanner", () => {
    it("stays hidden for verified, OAuth, and recently dismissed users", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      localStorage.setItem("email_verification_dismissed", now.toString());

      const { rerender } = render(
        <EmailVerificationBanner email="avery@example.com" emailVerified isOAuthUser={false} />,
      );
      expect(screen.queryByText("Verify your email")).not.toBeInTheDocument();

      rerender(
        <EmailVerificationBanner email="avery@example.com" emailVerified={false} isOAuthUser />,
      );
      expect(screen.queryByText("Verify your email")).not.toBeInTheDocument();

      rerender(
        <EmailVerificationBanner
          email="avery@example.com"
          emailVerified={false}
          isOAuthUser={false}
        />,
      );
      expect(screen.queryByText("Verify your email")).not.toBeInTheDocument();
    });

    it("resends verification email, runs cooldown, and dismisses the banner", async () => {
      vi.useFakeTimers();

      render(
        <EmailVerificationBanner
          email="avery@example.com"
          emailVerified={false}
          isOAuthUser={false}
        />,
      );

      expect(screen.getByText("Verify your email")).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
        await flushMicrotasks();
      });

      expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
        email: "avery@example.com",
        callbackURL: "/verify-email",
      });
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "Verification email sent! Check your inbox.",
      );
      expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Resend in 60s" }));
      expect(mocks.sendVerificationEmail).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(screen.getByRole("button", { name: "Resend verification email" })).toBeEnabled();

      fireEvent.click(screen.getByLabelText("Dismiss"));
      expect(screen.queryByText("Verify your email")).not.toBeInTheDocument();
      expect(localStorage.getItem("email_verification_dismissed")).toBeTruthy();
    });

    it("clears expired dismissal and reports resend errors", async () => {
      vi.spyOn(Date, "now").mockReturnValue(9 * 24 * 60 * 60 * 1000);
      localStorage.setItem("email_verification_dismissed", "0");
      mocks.sendVerificationEmail
        .mockResolvedValueOnce({ error: { message: "Mail quota reached" } })
        .mockRejectedValueOnce(new Error("network"));
      const user = userEvent.setup();

      render(
        <EmailVerificationBanner
          email="avery@example.com"
          emailVerified={false}
          isOAuthUser={false}
        />,
      );

      expect(await screen.findByText("Verify your email")).toBeInTheDocument();
      expect(localStorage.getItem("email_verification_dismissed")).toBeNull();

      await user.click(screen.getByRole("button", { name: "Resend verification email" }));
      expect(mocks.toast.error).toHaveBeenCalledWith("Mail quota reached");

      await user.click(screen.getByRole("button", { name: "Resend verification email" }));
      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Something went wrong. Please try again."),
      );
    });
  });

  describe("PasswordInput", () => {
    it("supports uncontrolled visibility toggling without the strength meter", async () => {
      const user = userEvent.setup();
      render(<PasswordInput aria-label="Password" hasError className="custom-class" />);

      const input = screen.getByLabelText("Password");
      expect(input).toHaveAttribute("type", "password");

      await user.type(input, "secret");
      expect(input).toHaveValue("secret");
      expect(screen.queryByText("Strong")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Show password" }));
      expect(input).toHaveAttribute("type", "text");
      await user.click(screen.getByRole("button", { name: "Hide password" }));
      expect(input).toHaveAttribute("type", "password");
    });

    it("debounces strength and breach checks for controlled values", async () => {
      vi.useFakeTimers();
      const onStrengthChange = vi.fn();

      render(
        <PasswordInput
          aria-label="Password"
          checkBreach
          email="avery@example.com"
          name="Avery"
          onStrengthChange={onStrengthChange}
          showStrengthMeter
          value="long-password"
        />,
      );

      await act(async () => {
        vi.advanceTimersByTime(150);
        await flushMicrotasks();
      });
      expect(mocks.checkPasswordStrength).toHaveBeenCalledWith("long-password", [
        "avery@example.com",
        "Avery",
      ]);
      expect(onStrengthChange).toHaveBeenCalledWith(expect.any(Object));

      await act(async () => {
        vi.advanceTimersByTime(350);
        await flushMicrotasks();
      });
      expect(mocks.checkBreached).toHaveBeenCalledWith("long-password");
    });

    it("clears strength state and skips breach checks for short or empty values", async () => {
      const onStrengthChange = vi.fn();
      const { rerender } = render(
        <PasswordInput
          aria-label="Password"
          checkBreach
          onStrengthChange={onStrengthChange}
          showStrengthMeter
          value="short"
        />,
      );

      expect(screen.getByLabelText("Password")).toHaveValue("short");
      expect(mocks.checkBreached).not.toHaveBeenCalled();

      rerender(
        <PasswordInput
          aria-label="Password"
          checkBreach
          onStrengthChange={onStrengthChange}
          showStrengthMeter
          value=""
        />,
      );

      expect(onStrengthChange).toHaveBeenCalledWith(null);
      expect(screen.queryByText("Very Weak")).not.toBeInTheDocument();
    });
  });

  describe("GoogleButton", () => {
    it("starts Google sign-in, shows loading state, and calls success callbacks", async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      let resolveSignIn: (value: unknown) => void = () => undefined;
      mocks.signInSocial.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSignIn = resolve;
          }),
      );

      render(
        <GoogleButton
          callbackURL="/dashboard"
          fullWidth
          onSuccess={onSuccess}
          text="Sign in with Google"
        />,
      );

      await user.click(screen.getByRole("button", { name: "Sign in with Google" }));
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
      expect(mocks.signInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/dashboard",
      });

      await act(async () => {
        resolveSignIn({ data: {}, error: null });
        await flushMicrotasks();
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it.each([
      [new Error("Popup blocked"), "Popup blocked. Please allow popups for this site."],
      [new Error("network fetch failed"), "Network error. Check your connection."],
      [new Error("user cancelled"), "Sign in was cancelled."],
      [new Error("oauth failed"), "Sign in failed. Please try again."],
      ["blocked", "Sign in failed. Please try again."],
    ])("maps sign-in error %s to a friendly toast", async (error, message) => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks.signInSocial.mockRejectedValueOnce(error);

      render(<GoogleButton />);

      await user.click(screen.getByRole("button", { name: "Continue with Google" }));

      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(message));
      expect(consoleError).toHaveBeenCalledWith("Google sign in error:", error);
    });

    it("does not submit when externally disabled", async () => {
      const user = userEvent.setup();

      render(<GoogleButton disabled />);

      await user.click(screen.getByRole("button", { name: "Continue with Google" }));
      expect(mocks.signInSocial).not.toHaveBeenCalled();
    });
  });

  describe("TemplatePreviewModal", () => {
    it("returns null for invalid selected indexes and inactive keyboard listeners", () => {
      const onNavigate = vi.fn();
      const { container, rerender } = render(
        <TemplatePreviewModal
          isOpen
          onClose={vi.fn()}
          onNavigate={onNavigate}
          selectedIndex={999}
        />,
      );
      expect(container).toBeEmptyDOMElement();

      rerender(
        <TemplatePreviewModal
          isOpen={false}
          onClose={vi.fn()}
          onNavigate={onNavigate}
          selectedIndex={0}
        />,
      );
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it("navigates with buttons, wraps at the ends, and handles arrow keys", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      const onClose = vi.fn();
      const { rerender } = render(
        <TemplatePreviewModal isOpen onClose={onClose} onNavigate={onNavigate} selectedIndex={0} />,
      );

      expect(screen.getByText("Minimalist Editorial")).toBeInTheDocument();
      expect(screen.getByTestId("template-minimalist_editorial")).toHaveTextContent("Sarah Chen");

      await user.click(screen.getByRole("button", { name: "Previous template" }));
      expect(onNavigate).toHaveBeenLastCalledWith(DEMO_PROFILES.length - 1);

      await user.click(screen.getByRole("button", { name: "Next template" }));
      expect(onNavigate).toHaveBeenLastCalledWith(1);

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(onNavigate).toHaveBeenLastCalledWith(DEMO_PROFILES.length - 1);

      rerender(
        <TemplatePreviewModal
          isOpen
          onClose={onClose}
          onNavigate={onNavigate}
          selectedIndex={DEMO_PROFILES.length - 1}
        />,
      );
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(onNavigate).toHaveBeenLastCalledWith(0);

      await user.click(screen.getByRole("button", { name: "Close preview" }));
      expect(onClose).toHaveBeenCalled();
    });

    it("uses dark modal chrome for dark template backgrounds", () => {
      render(
        <TemplatePreviewModal isOpen onClose={vi.fn()} onNavigate={vi.fn()} selectedIndex={5} />,
      );

      expect(screen.getByText("Midnight")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next template" })).toHaveClass("text-slate-300");
    });
  });

  describe("ShareBar", () => {
    it("uses native sharing, social targets, and handle-derived copy URLs", async () => {
      const user = userEvent.setup();
      render(<ShareBar handle="avery" name="" title="Avery Portfolio" variant="dev-terminal" />);

      expect(await screen.findByRole("button", { name: "Share this page" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Share this page" }));
      // eslint-disable-next-line typescript/unbound-method -- vitest mock assertion
      expect(navigator.share).toHaveBeenCalledWith({
        title: "Avery Portfolio",
        text: "Check out someone's portfolio",
        url: "http://localhost:3000/@avery",
      });

      await user.click(screen.getByRole("button", { name: "Share on X (Twitter)" }));
      expect(window.open).toHaveBeenLastCalledWith(
        expect.stringContaining("https://twitter.com/intent/tweet?"),
        "_blank",
        "noopener,noreferrer",
      );

      await user.click(screen.getByRole("button", { name: "Share on LinkedIn" }));
      expect(window.open).toHaveBeenLastCalledWith(
        expect.stringContaining("https://www.linkedin.com/sharing/share-offsite/"),
        "_blank",
        "noopener,noreferrer",
      );

      await user.click(screen.getByRole("button", { name: "Share on WhatsApp" }));
      expect(window.open).toHaveBeenLastCalledWith(
        expect.stringContaining("https://wa.me/?"),
        "_blank",
        "noopener,noreferrer",
      );

      await user.click(screen.getByRole("button", { name: "Copy link" }));
      expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://localhost:3000/@avery");
      expect(mocks.toast.success).toHaveBeenCalledWith("Link copied!");
    });

    it("hides native sharing when unsupported and reports copy/native share failures", async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      Object.defineProperty(navigator, "canShare", {
        value: undefined,
        configurable: true,
      });
      mocks.copyToClipboard.mockRejectedValueOnce(new Error("blocked"));

      const { unmount } = render(
        <ShareBar
          name="Avery Quinn"
          title="Avery"
          url="https://clickfolio.me/@avery"
          variant="minimalist-editorial"
        />,
      );

      expect(screen.queryByRole("button", { name: "Share this page" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Copy link" }));
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to copy link");

      unmount();
      Object.defineProperty(navigator, "canShare", {
        value: vi.fn(() => true),
        configurable: true,
      });
      Object.defineProperty(navigator, "share", {
        value: vi.fn(async () => {
          throw new Error("share blocked");
        }),
        configurable: true,
      });
      render(
        <ShareBar
          name="Avery Quinn"
          title="Avery"
          url="https://clickfolio.me/@avery"
          variant="glass-morphic"
        />,
      );

      expect(await screen.findByRole("button", { name: "Share this page" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Share this page" }));
      expect(consoleError).toHaveBeenCalledWith("Share failed:", expect.any(Error));
    });
  });

  describe("small dashboard and form helpers", () => {
    it("shows one unshown milestone toast and cleans up pending milestone timers", () => {
      vi.useFakeTimers();
      localStorage.setItem("milestone_shown_1", "true");

      const { unmount } = render(<MilestoneToasts totalViews={10} />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mocks.toast.success).toHaveBeenCalledWith("📈 10 people have seen your portfolio!", {
        duration: 5000,
      });
      expect(localStorage.getItem("milestone_shown_10")).toBe("true");

      mocks.toast.success.mockClear();
      unmount();
      const pending = render(<MilestoneToasts totalViews={100} />);
      pending.unmount();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mocks.toast.success).not.toHaveBeenCalled();
    });

    it("renders save indicator statuses and relative timestamps", () => {
      vi.spyOn(Date, "now").mockReturnValue(new Date("2026-05-20T12:00:00Z").getTime());

      const { container, rerender } = render(<SaveIndicator status="idle" />);
      expect(container).toBeEmptyDOMElement();

      rerender(<SaveIndicator status="saving" />);
      expect(screen.getByText("Saving...")).toBeInTheDocument();

      rerender(<SaveIndicator lastSaved={new Date("2026-05-20T11:59:30Z")} status="saved" />);
      expect(screen.getByText("Saved just now")).toBeInTheDocument();

      rerender(<SaveIndicator lastSaved={new Date("2026-05-20T11:50:00Z")} status="saved" />);
      expect(screen.getByText("Saved 10m ago")).toBeInTheDocument();

      rerender(<SaveIndicator lastSaved={new Date("2026-05-20T10:00:00Z")} status="saved" />);
      expect(screen.getByText(/Saved/)).toBeInTheDocument();

      rerender(<SaveIndicator status="saved" />);
      expect(screen.queryByText(/Saved/)).not.toBeInTheDocument();

      rerender(<SaveIndicator status="error" />);
      expect(screen.getByText("Save failed")).toBeInTheDocument();

      rerender(<SaveIndicator status="unsaved" />);
      expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("normalizes comma-separated arrays and syncs external values when not focused", async () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      const { rerender } = render(
        <CommaArrayInput
          onBlur={onBlur}
          onChange={onChange}
          placeholder="Skills"
          value={["React", "Cloudflare"]}
        />,
      );

      const input = screen.getByPlaceholderText("Skills");
      expect(input).toHaveValue("React, Cloudflare");

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "React, , TypeScript " } });
      rerender(
        <CommaArrayInput
          onBlur={onBlur}
          onChange={onChange}
          placeholder="Skills"
          value={["Ignored"]}
        />,
      );
      expect(input).toHaveValue("React, , TypeScript ");

      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledWith(["React", "TypeScript"]);
      expect(onBlur).toHaveBeenCalled();
      expect(input).toHaveValue("Ignored");

      rerender(
        <CommaArrayInput onChange={onChange} placeholder="Skills" value={["Workers", "D1"]} />,
      );
      expect(screen.getByPlaceholderText("Skills")).toHaveValue("Workers, D1");
    });

    it("copies dashboard and referral links and reports failures", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <div>
          <CopyLinkButton handle="avery" />
          <ReferralStats clickCount={0} referralCode="REF123" referralCount={0} />
        </div>,
      );

      expect(screen.queryByText("0 clicks")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Copy Share Link" }));
      expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://localhost:3000/@avery");
      expect(mocks.toast.success).toHaveBeenCalledWith("Link copied to clipboard!");

      await user.click(screen.getByRole("button", { name: "Copy Link" }));
      expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://localhost:3000/?ref=REF123");
      expect(mocks.toast.success).toHaveBeenCalledWith("Referral link copied!");

      mocks.copyToClipboard.mockRejectedValueOnce(new Error("blocked"));
      rerender(<ReferralStats clickCount={1} referralCode="REF456" referralCount={1} />);
      expect(
        screen.getAllByText((_, node) => node?.textContent === "1 click").length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText((_, node) => node?.textContent === "1 signup").length,
      ).toBeGreaterThan(0);
      expect(screen.getByText("100% conversion")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Copy Link" }));
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to copy link");
    });

    it("handles edit wrapper save success, autosave, and API error branches", async () => {
      const user = userEvent.setup();
      vi.mocked(fetch)
        .mockResolvedValueOnce(Response.json({ ok: true }))
        .mockResolvedValueOnce(Response.json({ ok: true }))
        .mockResolvedValueOnce(Response.json({ error: "too many edits" }, { status: 429 }))
        .mockResolvedValueOnce(Response.json({ error: "expired" }, { status: 401 }))
        .mockResolvedValueOnce(Response.json({ error: "bad content" }, { status: 400 }));

      render(<EditResumeFormWrapper initialData={resumeContent} />);

      await user.click(screen.getByRole("button", { name: "Publish Changes" }));
      await waitFor(() => expect(mocks.router.refresh).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole("button", { name: "Autosave" }));
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(mocks.router.refresh).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: "Publish Changes" }));
      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith(
          "Rate limit exceeded. Please try again later.",
        ),
      );

      await user.click(screen.getByRole("button", { name: "Publish Changes" }));
      await waitFor(() =>
        expect(mocks.toast.error).toHaveBeenCalledWith("Session expired. Please log in again."),
      );

      await user.click(screen.getByRole("button", { name: "Publish Changes" }));
      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("bad content"));
    });
  });

  describe("YouAreLiveModal", () => {
    it("shares, copies resume and referral links, and closes through the view link", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<YouAreLiveModal handle="avery" onOpenChange={onOpenChange} open />);

      await user.click(screen.getByRole("button", { name: "Copy link" }));
      expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://localhost:3000/@avery");

      await user.click(screen.getByRole("button", { name: "Share on LinkedIn" }));
      expect(window.open).toHaveBeenLastCalledWith(
        expect.stringContaining("https://www.linkedin.com/sharing/share-offsite/"),
        "_blank",
        "noopener,noreferrer",
      );

      await user.click(screen.getByRole("button", { name: "Twitter" }));
      expect(window.open).toHaveBeenLastCalledWith(
        expect.stringContaining("https://twitter.com/intent/tweet?"),
        "_blank",
        "noopener,noreferrer",
      );

      await user.click(screen.getByRole("button", { name: "WhatsApp" }));
      expect(window.open).toHaveBeenLastCalledWith(
        expect.stringContaining("https://wa.me/?"),
        "_blank",
        "noopener,noreferrer",
      );

      await user.click(screen.getByRole("button", { name: "Copy referral link" }));
      expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://localhost:3000/?ref=avery");

      await user.click(screen.getByRole("link", { name: /view my resume/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("uses explicit URLs and reports copy failures", async () => {
      const user = userEvent.setup();
      mocks.copyToClipboard
        .mockRejectedValueOnce(new Error("blocked"))
        .mockRejectedValueOnce(new Error("blocked"));

      render(
        <YouAreLiveModal
          handle="avery"
          onOpenChange={vi.fn()}
          open
          url="https://example.com/resume"
        />,
      );

      await user.click(screen.getByRole("button", { name: "Copy link" }));
      expect(mocks.copyToClipboard).toHaveBeenCalledWith("https://example.com/resume");
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to copy link");

      await user.click(screen.getByRole("button", { name: "Copy referral link" }));
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to copy link");
    });
  });
});
