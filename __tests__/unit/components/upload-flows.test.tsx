import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
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
    info: vi.fn(),
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

vi.mock("posthog-js", () => ({
  default: {
    __loaded: true,
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
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

/**
 * Mock XMLHttpRequest for the /api/upload call (the helper uses XHR for real
 * byte-level progress). Fires upload progress + load synchronously. Return
 * `{ networkError: true }` from the responder to simulate a network failure.
 */
function installXhrUpload(
  responder: (
    url: string,
    headers: Record<string, string>,
  ) => { status: number; body: unknown } | { networkError: true },
): () => void {
  const Original = globalThis.XMLHttpRequest;
  class MockXHR {
    static UNSENT = 0;
    static OPENED = 1;
    static HEADERS_RECEIVED = 2;
    static LOADING = 3;
    static DONE = 4;
    status = 0;
    response: unknown = null;
    upload = {
      onprogress: null as ((e: ProgressEvent) => void) | null,
      onloadstart: null as ((e: ProgressEvent) => void) | null,
    };
    onload: ((e: ProgressEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: ((e: ProgressEvent) => void) | null = null;
    ontimeout: (() => void) | null = null;
    private url = "";
    private headers: Record<string, string> = {};
    private responseTypeValue = "";

    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader(k: string, v: string) {
      this.headers[k] = v;
    }
    // eslint-disable-next-line accessor-pairs
    set responseType(v: string) {
      this.responseTypeValue = v;
    }
    get responseType() {
      return this.responseTypeValue;
    }
    send() {
      this.upload.onloadstart?.(new ProgressEvent("loadstart"));
      this.upload.onprogress?.(new ProgressEvent("progress", { loaded: 100, total: 100 }));
      const result = responder(this.url, this.headers);
      if ("networkError" in result) {
        this.onerror?.();
        return;
      }
      this.status = result.status;
      this.response = result.body;
      this.onload?.(new ProgressEvent("load"));
    }
    abort() {
      this.onabort?.(new ProgressEvent("abort"));
    }
  }
  globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;
  return () => {
    globalThis.XMLHttpRequest = Original;
  };
}

/** Standard 200 upload response. */
function okUpload(key = "temp/anon/resume.pdf") {
  return installXhrUpload(() => ({
    status: 200,
    body: { key, remaining: { hourly: 9, daily: 49 } },
  }));
}

function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    // eslint-disable-next-line typescript/no-base-to-string -- RequestInfo|URL; String() is idiomatic in test fetch mocks
    Promise.resolve(handler(String(input), init)),
  ) as unknown as typeof fetch;
}

/** Fetch handler for the non-upload endpoints (pending cookie, claim, site-data). */
function defaultFetch(extra?: Record<string, (init?: RequestInit) => Response>) {
  installFetch((url, init) => {
    if (url === "/api/upload/pending") return Response.json({ success: true });
    if (url === "/api/resume/claim") {
      if (extra?.claim) return extra.claim(init);
      return Response.json({ resume_id: "res_1" });
    }
    if (url === "/api/site-data") {
      if (extra?.siteData) return extra.siteData(init);
      return Response.json({ content: resumeContent });
    }
    return Response.json({ ok: true });
  });
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
  const originalFetch = globalThis.fetch;
  const originalXhr = globalThis.XMLHttpRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.sessionState.current = { data: null, isPending: false };
    mocks.waitResult = { status: "completed", error: undefined };
    mocks.getReferral.mockReturnValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXhr;
  });

  it("rejects invalid files in the public dropzone before hitting upload APIs", () => {
    render(<FileDropzone />);

    dropFile(new File(["hello"], "resume.txt", { type: "text/plain" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Only PDF files are allowed");
    expect(mocks.toast.error).toHaveBeenCalledWith("Only PDF files are allowed");
  });

  it("uploads an anonymous PDF and opens the auth handoff dialog", async () => {
    const restoreXhr = okUpload();
    defaultFetch();

    render(<FileDropzone />);
    dropFile(pdfFile());

    await waitFor(() => expect(screen.getByText("Upload Complete!")).toBeInTheDocument());
    expect(mocks.toast.success).toHaveBeenCalledWith("File uploaded successfully!");

    await userEvent.click(screen.getByRole("button", { name: /create a free account/i }));
    expect(screen.getByTestId("auth-dialog")).toHaveTextContent("/wizard");

    await userEvent.click(screen.getByRole("button", { name: /upload a different file/i }));
    expect(screen.getByText("Drop your PDF here")).toBeInTheDocument();
    restoreXhr();
  });

  it("rejects uploads when the pending-upload cookie cannot be stored", async () => {
    const restoreXhr = okUpload();
    installFetch((url) => {
      if (url === "/api/upload/pending")
        return Response.json({ error: "Cookie unavailable" }, { status: 500 });
      return Response.json({ ok: true });
    });

    render(<FileDropzone />);
    dropFile(pdfFile());

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to save pending upload");
    expect(screen.queryByText("Upload Complete!")).not.toBeInTheDocument();
    restoreXhr();
  });

  it("supports modal uploads, file picker changes, drag leave, and pending session handoff", async () => {
    const onOpenChange = vi.fn();
    mocks.sessionState.current = { data: null, isPending: true };
    const restoreXhr = okUpload("temp/modal/resume.pdf");
    defaultFetch();

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
    expect(screen.getByRole("button", { name: /create a free account/i })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    restoreXhr();
  });

  it("surfaces a non-retryable upload error (413) with a specific message", async () => {
    const restoreXhr = installXhrUpload(() => ({ status: 413, body: { error: "too large" } }));
    defaultFetch();

    render(<FileDropzone />);
    dropFile(pdfFile("large.pdf"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/File is too large/i);
    restoreXhr();
  });

  it("auto-claims authenticated public uploads and navigates to the dashboard", async () => {
    mocks.sessionState.current = {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    };
    mocks.getReferral.mockReturnValue("REF123");

    const restoreXhr = okUpload("temp/auth/resume.pdf");
    installFetch((url, init) => {
      if (url === "/api/resume/claim") {
        expect(init?.body).toContain("REF123");
        expect(init?.body).toContain("pre_auth");
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
    restoreXhr();
  });

  it("surfaces claim errors and lets users reset the public dropzone", async () => {
    mocks.sessionState.current = {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    };
    const restoreXhr = okUpload("temp/auth/resume.pdf");
    installFetch((url) => {
      if (url === "/api/resume/claim")
        return Response.json({ error: "This resume was already claimed." }, { status: 409 });
      return Response.json({ success: true });
    });

    render(<FileDropzone />);
    dropFile(pdfFile("duplicate.pdf"));

    await waitFor(() =>
      expect(screen.getByText("This resume was already claimed.")).toBeInTheDocument(),
    );
    // The public dropzone surfaces a retry control after a claim error.
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    restoreXhr();
  });

  it("maps claim status failures and closes modal after authenticated claim success", async () => {
    const onOpenChange = vi.fn();
    mocks.sessionState.current = {
      data: { user: { id: "user_1", email: "avery@example.com", name: "Avery" } },
      isPending: false,
    };
    let restoreXhr = okUpload("temp/auth/missing.pdf");
    installFetch((url) => {
      if (url === "/api/resume/claim") throw new Response(null, { status: 404 });
      return Response.json({ success: true });
    });

    const { unmount } = render(<FileDropzone />);
    dropFile(pdfFile("missing.pdf"));
    expect(
      await screen.findByText("Upload not found. Please try uploading again."),
    ).toBeInTheDocument();
    unmount();
    restoreXhr();

    restoreXhr = okUpload("temp/auth/modal.pdf");
    installFetch((url) => {
      if (url === "/api/resume/claim") return Response.json({ resume_id: "res_modal" });
      return Response.json({ success: true });
    });

    render(<FileDropzone open={true} onOpenChange={onOpenChange} />);
    dropFile(pdfFile("modal-claim.pdf"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard"));
    restoreXhr();
  });

  it("uploads cached wizard resumes and continues with parsed site data", async () => {
    const onContinue = vi.fn();
    const restoreXhr = okUpload("temp/wizard/resume.pdf");
    installFetch((url) => {
      if (url === "/api/resume/claim") return Response.json({ resume_id: "res_1", cached: true });
      if (url === "/api/site-data") return Response.json({ content: resumeContent });
      return Response.json({ ok: true });
    });

    render(<UploadStep onContinue={onContinue} />);
    dropFile(pdfFile("cached.pdf"));

    await waitFor(() => expect(onContinue).toHaveBeenCalledWith(resumeContent));
    expect(mocks.clearReferral).toHaveBeenCalled();
    expect(mocks.toast.success).toHaveBeenCalledWith("Resume parsed successfully!");
    restoreXhr();
  });

  it("shows wizard upload errors and retry state", async () => {
    const restoreXhr = installXhrUpload(() => ({
      status: 429,
      body: { error: "Too many upload attempts" },
    }));
    installFetch((url) => {
      if (url === "/api/resume/claim") return Response.json({ resume_id: "res_1" });
      return Response.json({ ok: true });
    });

    render(<UploadStep onContinue={vi.fn()} />);
    dropFile(pdfFile("rate-limited.pdf"));

    await waitFor(() => expect(screen.getByText("Something Went Wrong")).toBeInTheDocument());
    expect(screen.getByText("Too many upload attempts")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(screen.getByText("Drop your PDF resume here")).toBeInTheDocument();
    restoreXhr();
  });

  it("handles non-cached wizard parsing completion and failure", async () => {
    const onContinue = vi.fn();
    let restoreXhr = okUpload("temp/wizard/live.pdf");
    installFetch((url) => {
      if (url === "/api/resume/claim")
        return Response.json({ resume_id: "res_live", cached: false });
      if (url === "/api/site-data") return Response.json({ content: resumeContent });
      return Response.json({ ok: true });
    });

    const { unmount } = render(<UploadStep onContinue={onContinue} />);
    dropFile(pdfFile("live.pdf"));
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith(resumeContent));
    unmount();
    restoreXhr();

    mocks.waitResult = { status: "failed", error: "Parser failed" };
    onContinue.mockClear();
    restoreXhr = okUpload("temp/wizard/failed.pdf");
    render(<UploadStep onContinue={onContinue} />);
    dropFile(pdfFile("failed.pdf"));

    await waitFor(() => expect(screen.getByText("Parser failed")).toBeInTheDocument());
    expect(onContinue).not.toHaveBeenCalled();
    restoreXhr();
  });
});
