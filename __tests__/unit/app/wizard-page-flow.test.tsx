import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ResumeContent } from "@/lib/types/database";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
  sessionState: {
    current: {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    } as {
      data: {
        user: { id: string; email: string; name: string; onboardingCompleted?: boolean };
      } | null;
      isPending: boolean;
    },
  },
  clearPendingUploadCookie: vi.fn(async () => undefined),
  waitForResumeCompletion: vi.fn(
    async (_resumeId: string): Promise<{ status: "completed" | "failed"; error?: string }> => ({
      status: "completed",
    }),
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => mocks.sessionState.current,
}));

vi.mock("@/lib/utils/pending-upload-client", () => ({
  clearPendingUploadCookie: () => mocks.clearPendingUploadCookie(),
}));

vi.mock("@/lib/utils/wait-for-completion", () => ({
  waitForResumeCompletion: (resumeId: string) => mocks.waitForResumeCompletion(resumeId),
}));

vi.mock("@/components/Confetti", () => ({ Confetti: () => <div>confetti</div> }));
vi.mock("@/components/YouAreLiveModal", () => ({
  YouAreLiveModal: ({
    open,
    handle,
    onOpenChange,
  }: {
    open: boolean;
    handle: string;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onOpenChange(false)}>
        live {handle}
      </button>
    ) : null,
}));

vi.mock("@/components/wizard", () => ({
  WizardProgress: ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => (
    <div>
      progress {currentStep}/{totalSteps}
    </div>
  ),
}));

vi.mock("@/components/wizard/UploadStep", () => ({
  UploadStep: ({ onContinue }: { onContinue: (content: ResumeContent) => void }) => (
    <button type="button" onClick={() => onContinue(resumeContent)}>
      upload-step
    </button>
  ),
}));

vi.mock("@/components/wizard/HandleStep", () => ({
  HandleStep: ({
    onContinue,
    initialHandle,
  }: {
    onContinue: (handle: string) => void;
    initialHandle: string;
  }) => (
    <button type="button" onClick={() => onContinue(initialHandle || "avery")}>
      handle-step
    </button>
  ),
}));

vi.mock("@/components/wizard/ReviewStep", () => ({
  ReviewStep: ({ content, onContinue }: { content: ResumeContent; onContinue: () => void }) => (
    <button type="button" onClick={onContinue}>
      review-step {content.full_name}
    </button>
  ),
}));

vi.mock("@/components/wizard/PrivacyStep", () => ({
  PrivacyStep: ({
    onContinue,
  }: {
    onContinue: (settings: {
      show_phone: boolean;
      show_address: boolean;
      show_in_directory: boolean;
      hide_from_search: boolean;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onContinue({
          show_phone: true,
          show_address: false,
          show_in_directory: true,
          hide_from_search: false,
        })
      }
    >
      privacy-step
    </button>
  ),
}));

vi.mock("@/components/wizard/ThemeStep", () => ({
  ThemeStep: ({
    onContinue,
    referralCount,
    isPro,
  }: {
    onContinue: (themeId: string) => void;
    referralCount: number;
    isPro: boolean;
  }) => (
    <button type="button" onClick={() => onContinue("minimalist_editorial")}>
      theme-step {referralCount} {String(isPro)}
    </button>
  ),
}));

const resumeContent: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Staff Product Engineer",
  summary: "Builds reliable products.",
  contact: { email: "avery@example.com" },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

type FetchScenario =
  | "site-data"
  | "needs-upload"
  | "processing"
  | "pending-claim"
  | "complete-error";

function installFetchScenario(scenario: FetchScenario) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/upload/pending") {
      return Response.json(
        scenario === "pending-claim"
          ? { key: "temp/resume.pdf", file_hash: "hash_1" }
          : { key: null, file_hash: null },
      );
    }
    if (url === "/api/resume/claim") {
      expect(init?.body).toContain("temp/resume.pdf");
      return Response.json({ resume_id: "res_1", cached: scenario === "pending-claim" });
    }
    if (url === "/api/site-data") {
      return Response.json(
        scenario === "needs-upload" || scenario === "processing"
          ? null
          : { content: resumeContent },
      );
    }
    if (url === "/api/user/stats") {
      return Response.json({ referralCount: 4, isPro: true });
    }
    if (url === "/api/resume/latest-status") {
      return Response.json(
        scenario === "processing" ? { id: "res_processing", status: "processing" } : null,
      );
    }
    if (url === "/api/wizard/complete") {
      return Response.json(
        scenario === "complete-error" ? { error: "Handle taken" } : { success: true },
        { status: scenario === "complete-error" ? 400 : 200 },
      );
    }
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
}

describe("wizard page flow", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.sessionState.current = {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    };
    mocks.waitForResumeCompletion.mockResolvedValue({ status: "completed" });
    installFetchScenario("site-data");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows loading while session state is pending and redirects unauthenticated users", async () => {
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");

    mocks.sessionState.current = { data: null, isPending: true };
    const { rerender } = render(<WizardPage />);
    expect(screen.getByText("Loading your resume...")).toBeInTheDocument();

    mocks.sessionState.current = { data: null, isPending: false };
    rerender(<WizardPage />);
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
  });

  it("walks through site-data backed onboarding and opens the live modal", async () => {
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");
    render(<WizardPage />);

    await waitFor(() => expect(screen.getByText("handle-step")).toBeInTheDocument());

    await userEvent.click(screen.getByText("handle-step"));
    expect(screen.getByText(/review-step Avery Quinn/)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/review-step/));
    await userEvent.click(screen.getByText("privacy-step"));
    expect(screen.getByText(/theme-step/)).toHaveTextContent("4 true");
    await userEvent.click(screen.getByText(/theme-step/));

    await waitFor(() => expect(screen.getByText("confetti")).toBeInTheDocument());
    expect(screen.getByText("live avery")).toBeInTheDocument();
    await userEvent.click(screen.getByText("live avery"));
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard");
  });

  it("claims pending uploads before loading site data", async () => {
    installFetchScenario("pending-claim");
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");

    render(<WizardPage />);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/resume/claim", expect.any(Object)),
    );
    expect(mocks.clearPendingUploadCookie).toHaveBeenCalled();
    expect(screen.getByText("handle-step")).toBeInTheDocument();
  });

  it("routes users to waiting or upload states when site data is absent", async () => {
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");

    installFetchScenario("processing");
    const { unmount } = render(<WizardPage />);
    await waitFor(() =>
      expect(mocks.router.push).toHaveBeenCalledWith("/waiting?resume_id=res_processing"),
    );
    unmount();

    installFetchScenario("needs-upload");
    render(<WizardPage />);
    await waitFor(() => expect(screen.getByText("upload-step")).toBeInTheDocument());
    await userEvent.click(screen.getByText("upload-step"));
    expect(screen.getByText("handle-step")).toBeInTheDocument();
  });

  it("surfaces wizard completion API errors inline", async () => {
    installFetchScenario("complete-error");
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");
    render(<WizardPage />);

    await waitFor(() => expect(screen.getByText("handle-step")).toBeInTheDocument());
    await userEvent.click(screen.getByText("handle-step"));
    await userEvent.click(screen.getByText(/review-step/));
    await userEvent.click(screen.getByText("privacy-step"));
    await userEvent.click(screen.getByText(/theme-step/));

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Handle taken"));
    expect(screen.getByText("Handle taken")).toBeInTheDocument();
  });

  it("claims pending uploads for returning users and always redirects to dashboard", async () => {
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");
    mocks.sessionState.current = {
      data: {
        user: {
          id: "user_1",
          email: "avery@example.com",
          name: "Avery",
          onboardingCompleted: true,
        },
      },
      isPending: false,
    };

    installFetchScenario("pending-claim");
    const cached = render(<WizardPage />);
    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith("Resume updated successfully!"),
    );
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard");
    cached.unmount();

    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/upload/pending") {
        return Response.json({ key: "temp/new.pdf", file_hash: null });
      }
      if (url === "/api/resume/claim") {
        return Response.json({ resume_id: "res_new", cached: false });
      }
      return Response.json(null);
    }) as unknown as typeof fetch;
    const processing = render(<WizardPage />);
    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "Resume uploaded! Processing in background.",
      ),
    );
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard");
    processing.unmount();

    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/upload/pending") {
        return Response.json({ key: "temp/bad.pdf", file_hash: null });
      }
      if (url === "/api/resume/claim") {
        return Response.json({ error: "Claim failed" }, { status: 400 });
      }
      return Response.json(null);
    }) as unknown as typeof fetch;
    render(<WizardPage />);
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Claim failed"));
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard");
  });

  it("uses sessionStorage fallback, handles parsing failure redirects, and reports init crashes", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { default: WizardPage } = await import("@/app/(protected)/wizard/page");
      sessionStorage.setItem(
        "temp_upload",
        JSON.stringify({
          key: "temp/session.pdf",
          timestamp: Date.now(),
          expiresAt: Date.now() + 30_000,
        }),
      );
      sessionStorage.setItem("temp_file_hash", "hash_1");
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/upload/pending") {
          throw new Error("cookie unavailable");
        }
        if (url === "/api/resume/claim") {
          return Response.json({ resume_id: "res_session", cached: false });
        }
        return Response.json(null);
      }) as unknown as typeof fetch;
      mocks.waitForResumeCompletion.mockResolvedValueOnce({
        status: "failed",
        error: "Parser failed",
      });

      const failed = render(<WizardPage />);
      await waitFor(() =>
        expect(mocks.waitForResumeCompletion).toHaveBeenCalledWith("res_session"),
      );
      failed.unmount();

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/site-data") {
          throw new Error("site-data down");
        }
        return Response.json({ key: null, file_hash: null });
      }) as unknown as typeof fetch;
      const loader = render(<WizardPage />);
      await waitFor(() =>
        expect(
          screen.getByText("Failed to load resume data. Please try again."),
        ).toBeInTheDocument(),
      );
      loader.unmount();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("cleans expired and invalid fallback uploads and warns before abandoning later steps", async () => {
    const { default: WizardPage } = await import("@/app/(protected)/wizard/page");

    sessionStorage.setItem("temp_upload", "not-json");
    installFetchScenario("site-data");
    const invalid = render(<WizardPage />);
    await waitFor(() => expect(sessionStorage.getItem("temp_upload")).toBeNull());
    invalid.unmount();

    sessionStorage.setItem(
      "temp_upload",
      JSON.stringify({ key: "temp/expired.pdf", timestamp: 1, expiresAt: Date.now() - 1 }),
    );
    const expired = render(<WizardPage />);
    await waitFor(() => expect(sessionStorage.getItem("temp_upload")).toBeNull());
    await waitFor(() => expect(screen.getByText("handle-step")).toBeInTheDocument());

    await userEvent.click(screen.getByText("handle-step"));
    const event = new Event("beforeunload", { cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    expired.unmount();
  });
});
