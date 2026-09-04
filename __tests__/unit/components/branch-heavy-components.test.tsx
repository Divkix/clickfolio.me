import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { MilestoneToasts } from "@/components/dashboard/MilestoneToasts";
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
import type { JsonValue } from "@/lib/types/json";

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
  copyToClipboard: (...args: JsonValue[]) => mocks.copyToClipboard(...args),
}));

vi.mock("@/lib/analytics/client", () => ({
  trackAnalyticsEvent: vi.fn(),
  identifyAnalyticsUser: vi.fn(),
  resetAnalyticsIdentity: vi.fn(),
  isAnalyticsInitialized: vi.fn(() => true),
  captureAnalyticsError: vi.fn(),
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
  ) as Record<ThemeId, React.ComponentType<JsonValue>>,
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

    it("reports copy failures and avoids saving an unchanged handle", async () => {
      mocks.copyToClipboard.mockResolvedValueOnce(false);

      render(<HandleForm currentHandle="avery" />);

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
      expect(screen.getByText("Preview: clickfolio.me/@new-handle")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Update" }));

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
        Response.json({ error: "Handle is taken" }, { status: 409 }),
      );
      rerender(<HandleForm currentHandle="avery" />);

      await user.clear(screen.getByLabelText("Change Handle"));
      await user.type(screen.getByLabelText("Change Handle"), "taken-handle");
      await user.click(screen.getByRole("button", { name: "Update" }));

      await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Handle is taken"));
    });

    it("shows validation errors and reports thrown update failures", async () => {
      const user = userEvent.setup();
      render(<HandleForm currentHandle="avery" />);

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
      expect(screen.getByText("Saved 10 minutes ago")).toBeInTheDocument();

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

    it("copies the dashboard share link and reports failures", async () => {
      const user = userEvent.setup();
      render(<CopyLinkButton handle="avery" />);

      await user.click(screen.getByRole("button", { name: "Copy Share Link" }));
      expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://localhost:3000/@avery");
      expect(mocks.toast.success).toHaveBeenCalledWith("Link copied to clipboard!");

      mocks.copyToClipboard.mockRejectedValueOnce(new Error("blocked"));
      await user.click(screen.getByRole("button", { name: /Copy Share Link|Copied!/i }));
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to copy link. Please copy manually.");
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
    it("shares, copies the resume link, and closes through the view link", async () => {
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

      await user.click(screen.getByRole("link", { name: /view my resume/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("uses explicit URLs and reports copy failures", async () => {
      const user = userEvent.setup();
      mocks.copyToClipboard.mockRejectedValueOnce(new Error("blocked"));

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
    });
  });
});
