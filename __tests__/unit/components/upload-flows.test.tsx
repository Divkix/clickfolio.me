import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileDropzone } from "@/components/FileDropzone";
import { UploadStep } from "@/components/wizard/UploadStep";
import type { ResumeContent } from "@/lib/types/database";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  sessionState: {
    current: {
      data: null as { user: { id: string; email: string; name: string } } | null,
      isPending: false,
    },
  },
  waitResult: {
    status: "completed" as "completed" | "failed",
    error: undefined as string | undefined,
  },
  clearReferral: vi.fn(),
  getReferral: vi.fn(() => null as string | null),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => mocks.sessionState.current,
  signIn: {
    social: vi.fn().mockResolvedValue({ data: {}, error: null }),
    email: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
  signUp: {
    email: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
  Toaster: () => null,
}));

vi.mock("@/lib/referral", () => ({
  getStoredReferralCode: () => mocks.getReferral(),
  clearStoredReferralCode: () => mocks.clearReferral(),
}));

vi.mock("@/lib/utils/wait-for-completion", () => ({
  waitForResumeCompletion: vi.fn(async () => mocks.waitResult),
}));

vi.mock("@/components/auth/AuthDialog", () => ({
  AuthDialog: ({
    open,
    callbackURL,
  }: {
    open: boolean;
    callbackURL: string;
    onOpenChange: (open: boolean) => void;
  }) => (open ? <div data-testid="auth-dialog">Auth {callbackURL}</div> : null),
}));

const resumeContent: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Staff Product Engineer",
  summary: "Builds reliable products.",
  contact: { email: "avery@example.com", location: "Phoenix, AZ" },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

function pdfFile(name = "resume.pdf") {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init)),
  ) as unknown as typeof fetch;
}

function dropFile(file: File) {
  const dropzone = screen.getByRole("button", {
    name: /drop your pdf resume here or click to browse files/i,
  });
  fireEvent.dragEnter(dropzone, { dataTransfer: { files: [file] } });
  fireEvent.dragOver(dropzone, { dataTransfer: { files: [file] } });
  fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
}

describe("upload flow components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    sessionStorage.clear();
    mocks.sessionState.current = { data: null, isPending: false };
    mocks.waitResult = { status: "completed", error: undefined };
    mocks.getReferral.mockReturnValue(null);
  });

  it("rejects invalid files in the public dropzone before hitting upload APIs", () => {
    render(<FileDropzone />);

    dropFile(new File(["hello"], "resume.txt", { type: "text/plain" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Only PDF files are allowed");
    expect(mocks.toast.error).toHaveBeenCalledWith("Only PDF files are allowed");
  });

  it("uploads an anonymous PDF and opens the auth handoff dialog", async () => {
    installFetch((url) => {
      if (url === "/api/upload") {
        return Response.json({ key: "temp/anon/resume.pdf", remaining: { hourly: 9, daily: 49 } });
      }
      if (url === "/api/upload/pending") {
        return Response.json({ success: true });
      }
      return Response.json({ ok: true });
    });

    render(<FileDropzone />);
    dropFile(pdfFile());

    await waitFor(() => expect(screen.getByText("Upload Complete!")).toBeInTheDocument());
    expect(sessionStorage.getItem("temp_upload")).toContain("temp/anon/resume.pdf");
    expect(mocks.toast.success).toHaveBeenCalledWith("File uploaded successfully!");

    await userEvent.click(screen.getByRole("button", { name: /sign in to publish/i }));
    expect(screen.getByTestId("auth-dialog")).toHaveTextContent("/wizard");

    await userEvent.click(screen.getByRole("button", { name: /upload a different file/i }));
    expect(screen.getByText("Drop your PDF here")).toBeInTheDocument();
  });

  it("supports modal uploads, file picker changes, drag leave, and pending session handoff", async () => {
    const onOpenChange = vi.fn();
    mocks.sessionState.current = {
      data: null,
      isPending: true,
    };
    installFetch((url) => {
      if (url === "/api/upload") {
        return Response.json({ key: "temp/modal/resume.pdf", remaining: { hourly: 9, daily: 49 } });
      }
      return Response.json({ success: true });
    });

    render(<FileDropzone open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText("Upload New Resume")).toBeInTheDocument();
    expect(
      screen.queryByText("Upload anonymously. No account needed until you publish."),
    ).not.toBeInTheDocument();

    const dropzone = screen.getByRole("button", {
      name: /drop your pdf resume here or click to browse files/i,
    });
    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [pdfFile("modal.pdf")] } });
    fireEvent.dragLeave(dropzone, { dataTransfer: { files: [] } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdfFile("picker.pdf")] } });

    await waitFor(() => expect(screen.getByText("Upload Complete!")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sign in to publish/i })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("maps upload failures from responses, thrown statuses, and network errors", async () => {
    installFetch((url) => {
      if (url === "/api/upload") {
        return Response.json({ error: "Server rejected upload" }, { status: 500 });
      }
      return Response.json({ success: true });
    });
    const { unmount } = render(<FileDropzone />);
    dropFile(pdfFile("server.pdf"));
    expect(await screen.findByText("Server rejected upload")).toBeInTheDocument();
    unmount();

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/upload") {
        throw new Response(null, { status: 413 });
      }
      return Response.json({ success: true });
    }) as unknown as typeof fetch;
    const tooLarge = render(<FileDropzone />);
    dropFile(pdfFile("large.pdf"));
    expect(await screen.findByText(/File too large/)).toBeInTheDocument();
    tooLarge.unmount();

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/upload") {
        throw new Response(null, { status: 401 });
      }
      return Response.json({ success: true });
    }) as unknown as typeof fetch;
    const expired = render(<FileDropzone />);
    dropFile(pdfFile("expired.pdf"));
    expect(await screen.findByText("Session expired. Please sign in again.")).toBeInTheDocument();
    expired.unmount();

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/upload") {
        throw new Error("Network offline");
      }
      return Response.json({ success: true });
    }) as unknown as typeof fetch;
    render(<FileDropzone />);
    dropFile(pdfFile("network.pdf"));
    expect(await screen.findByText("Network error. Check your connection.")).toBeInTheDocument();
  });

  it("auto-claims authenticated public uploads and navigates to the dashboard", async () => {
    mocks.sessionState.current = {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    };
    mocks.getReferral.mockReturnValue("REF123");

    installFetch((url, init) => {
      if (url === "/api/upload") {
        return Response.json({ key: "temp/auth/resume.pdf", remaining: { hourly: 9, daily: 49 } });
      }
      if (url === "/api/resume/claim") {
        expect(init?.body).toContain("REF123");
        return Response.json({ resume_id: "res_1" });
      }
      return Response.json({ success: true });
    });

    render(<FileDropzone />);
    dropFile(pdfFile("auth.pdf"));

    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "Resume claimed successfully! Processing...",
      ),
    );
    expect(mocks.clearReferral).toHaveBeenCalled();
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.router.refresh).toHaveBeenCalled();
  });

  it("surfaces claim errors and lets users reset the public dropzone", async () => {
    mocks.sessionState.current = {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    };

    installFetch((url) => {
      if (url === "/api/upload") {
        return Response.json({ key: "temp/auth/resume.pdf", remaining: { hourly: 9, daily: 49 } });
      }
      if (url === "/api/resume/claim") {
        return Response.json({ error: "This resume was already claimed." }, { status: 409 });
      }
      return Response.json({ success: true });
    });

    render(<FileDropzone />);
    dropFile(pdfFile("duplicate.pdf"));

    await waitFor(() =>
      expect(screen.getByText("This resume was already claimed.")).toBeInTheDocument(),
    );
    expect(screen.getByText("This resume was already claimed.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/upload", expect.any(Object)));

    await waitFor(() =>
      expect(screen.getByText("This resume was already claimed.")).toBeInTheDocument(),
    );
  });

  it("maps claim status failures and closes modal after authenticated claim success", async () => {
    const onOpenChange = vi.fn();
    mocks.sessionState.current = {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    };
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/upload") {
        return Response.json({ key: "temp/auth/missing.pdf", remaining: { hourly: 9, daily: 49 } });
      }
      if (url === "/api/resume/claim") {
        throw new Response(null, { status: 404 });
      }
      return Response.json({ success: true });
    }) as unknown as typeof fetch;

    const { unmount } = render(<FileDropzone />);
    dropFile(pdfFile("missing.pdf"));
    expect(
      await screen.findByText("Upload not found. Please try uploading again."),
    ).toBeInTheDocument();
    unmount();

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/upload") {
        return Response.json({ key: "temp/auth/modal.pdf", remaining: { hourly: 9, daily: 49 } });
      }
      if (url === "/api/resume/claim") {
        return Response.json({ resume_id: "res_modal" });
      }
      return Response.json({ success: true });
    }) as unknown as typeof fetch;

    render(<FileDropzone open={true} onOpenChange={onOpenChange} />);
    dropFile(pdfFile("modal-claim.pdf"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("uploads cached wizard resumes and continues with parsed site data", async () => {
    const onContinue = vi.fn();
    installFetch((url) => {
      if (url === "/api/upload") {
        return Response.json({ key: "temp/wizard/resume.pdf", remaining: 9 });
      }
      if (url === "/api/resume/claim") {
        return Response.json({ resume_id: "res_1", cached: true });
      }
      if (url === "/api/site-data") {
        return Response.json({ content: resumeContent });
      }
      return Response.json({ ok: true });
    });

    render(<UploadStep onContinue={onContinue} />);
    dropFile(pdfFile("cached.pdf"));

    await waitFor(() => expect(onContinue).toHaveBeenCalledWith(resumeContent));
    expect(mocks.clearReferral).toHaveBeenCalled();
    expect(mocks.toast.success).toHaveBeenCalledWith("Resume parsed successfully!");
  });

  it("shows wizard upload errors and retry state", async () => {
    installFetch((url) => {
      if (url === "/api/upload") {
        return Response.json({ message: "Too many upload attempts" }, { status: 429 });
      }
      return Response.json({ ok: true });
    });

    render(<UploadStep onContinue={vi.fn()} />);
    dropFile(pdfFile("rate-limited.pdf"));

    await waitFor(() => expect(screen.getByText("Something Went Wrong")).toBeInTheDocument());
    expect(screen.getByText("Too many upload attempts")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(screen.getByText("Drop your PDF resume here")).toBeInTheDocument();
  });

  it("handles non-cached wizard parsing completion and failure", async () => {
    const onContinue = vi.fn();
    installFetch((url) => {
      if (url === "/api/upload") {
        return Response.json({ key: "temp/wizard/live.pdf", remaining: 9 });
      }
      if (url === "/api/resume/claim") {
        return Response.json({ resume_id: "res_live", cached: false });
      }
      if (url === "/api/site-data") {
        return Response.json({ content: resumeContent });
      }
      return Response.json({ ok: true });
    });

    const { unmount } = render(<UploadStep onContinue={onContinue} />);
    dropFile(pdfFile("live.pdf"));
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith(resumeContent));
    unmount();

    mocks.waitResult = { status: "failed", error: "Parser failed" };
    onContinue.mockClear();
    render(<UploadStep onContinue={onContinue} />);
    dropFile(pdfFile("failed.pdf"));

    await waitFor(() => expect(screen.getByText("Parser failed")).toBeInTheDocument());
    expect(onContinue).not.toHaveBeenCalled();
  });
});
