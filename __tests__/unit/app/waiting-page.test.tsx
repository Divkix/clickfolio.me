import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import WaitingPage from "@/app/(protected)/waiting/page";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  searchParams: "resume_id=res_123",
  resumeStatus: {
    status: "processing" as "processing" | "completed" | "failed" | null,
    progress: 55,
    error: null as string | null,
    canRetry: false,
    isLoading: false,
    refetch: vi.fn(async () => undefined),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams(mocks.searchParams),
}));

vi.mock("@/hooks/useResumeStatus", () => ({
  useResumeStatus: vi.fn(() => mocks.resumeStatus),
}));

describe("WaitingPage", () => {
  const originalFetch = globalThis.fetch;
  const originalAlert = globalThis.alert;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParams = "resume_id=res_123";
    mocks.resumeStatus.status = "processing";
    mocks.resumeStatus.progress = 55;
    mocks.resumeStatus.error = null;
    mocks.resumeStatus.canRetry = false;
    mocks.resumeStatus.isLoading = false;
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    globalThis.alert = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    globalThis.alert = originalAlert;
  });

  it("redirects to dashboard when no resume id is present", async () => {
    mocks.searchParams = "";
    const { container } = render(<WaitingPage />);

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/dashboard"));
    expect(container.textContent).toBe("");
  });

  it("renders processing stages, countdown, loading, and inline processing errors", async () => {
    vi.useFakeTimers();
    mocks.resumeStatus.status = null;
    mocks.resumeStatus.isLoading = true;
    const loading = render(<WaitingPage />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
    loading.unmount();

    mocks.resumeStatus.status = "processing";
    mocks.resumeStatus.isLoading = false;
    mocks.resumeStatus.progress = 55;
    mocks.resumeStatus.error = "Still processing";
    render(<WaitingPage />);

    expect(screen.getByText("Processing your resume with AI")).toBeInTheDocument();
    expect(screen.getByText("55% complete")).toBeInTheDocument();
    expect(screen.getByText("Analyzing Experience")).toBeInTheDocument();
    expect(screen.getByText("Still processing")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("~34 seconds remaining")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(35_000);
    });
    expect(screen.getByText("Almost there...")).toBeInTheDocument();
  });

  it("redirects completed resumes to the wizard after the success message", async () => {
    vi.useFakeTimers();
    mocks.resumeStatus.status = "completed";
    render(<WaitingPage />);

    expect(screen.getByText("Parsing Complete!")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mocks.router.push).toHaveBeenCalledWith("/wizard");
  });

  it("retries failed resumes and reports retry API failures", async () => {
    mocks.resumeStatus.status = "failed";
    mocks.resumeStatus.error = null;
    mocks.resumeStatus.canRetry = true;
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(Response.json({ error: "Queue unavailable" }, { status: 500 }));

    const { rerender } = render(<WaitingPage />);

    expect(screen.getByText("Unknown error occurred")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() => expect(mocks.resumeStatus.refetch).toHaveBeenCalled());
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/resume/retry",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resume_id: "res_123" }),
      }),
    );

    mocks.resumeStatus.error = "Parse failed";
    rerender(<WaitingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() => expect(globalThis.alert).toHaveBeenCalledWith("Queue unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Go to Dashboard" }));
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard");
  });
});
