import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { RealtimeStatusListener } from "@/components/dashboard/RealtimeStatusListener";

const mocks = vi.hoisted(() => {
  let socketArgs: null | {
    resumeId: string | null;
    onStatusChange: (status: string, errorMessage?: string) => void;
  } = null;

  return {
    router: {
      refresh: vi.fn(),
    },
    get socketArgs() {
      return socketArgs;
    },
    set socketArgs(value) {
      socketArgs = value;
    },
    useResumeWebSocket: vi.fn(
      (args: {
        resumeId: string | null;
        onStatusChange: (status: string, error?: string) => void;
      }) => {
        socketArgs = args;
      },
    ),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/hooks/useResumeWebSocket", () => ({
  useResumeWebSocket: (...args: Parameters<typeof mocks.useResumeWebSocket>) =>
    mocks.useResumeWebSocket(...args),
}));

describe("RealtimeStatusListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.socketArgs = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["processing", "queued"])("connects while %s and renders processing state", (status) => {
    render(<RealtimeStatusListener currentStatus={status} resumeId="resume_123" />);

    expect(screen.getByText("Processing Your Resume")).toBeInTheDocument();
    expect(mocks.socketArgs?.resumeId).toBe("resume_123");
  });

  it("does not connect for terminal initial statuses", () => {
    const { unmount } = render(
      <RealtimeStatusListener currentStatus="completed" resumeId="resume_123" />,
    );

    expect(screen.getByText("Processing Complete!")).toBeInTheDocument();
    const completedSocketArgs = mocks.socketArgs as { resumeId: string | null } | null;
    expect(completedSocketArgs?.resumeId).toBeNull();

    unmount();
    mocks.socketArgs = null;
    render(<RealtimeStatusListener currentStatus="failed" resumeId="resume_456" />);

    expect(screen.getByText("Processing Failed")).toBeInTheDocument();
    expect(screen.getByText("An error occurred while processing your resume.")).toBeInTheDocument();
    const failedSocketArgs = mocks.socketArgs as { resumeId: string | null } | null;
    expect(failedSocketArgs?.resumeId).toBeNull();
  });

  it("reacts to completed and failed socket updates with one debounced refresh", async () => {
    render(<RealtimeStatusListener currentStatus="processing" resumeId="resume_123" />);

    await act(async () => {
      mocks.socketArgs?.onStatusChange("completed");
    });

    expect(screen.getByText("Processing Complete!")).toBeInTheDocument();
    expect(mocks.router.refresh).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      mocks.socketArgs?.onStatusChange("failed", "Parser crashed");
      vi.advanceTimersByTime(200);
    });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("replaces a pending refresh timer when a later terminal update arrives", async () => {
    render(<RealtimeStatusListener currentStatus="queued" resumeId="resume_123" />);

    await act(async () => {
      mocks.socketArgs?.onStatusChange("completed");
      vi.advanceTimersByTime(100);
      mocks.socketArgs?.onStatusChange("failed", "AI provider failed");
    });

    expect(screen.getByText("Processing Failed")).toBeInTheDocument();
    expect(screen.getByText("AI provider failed")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(mocks.router.refresh).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });
});
