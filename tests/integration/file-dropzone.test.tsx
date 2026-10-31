import type * as ReactModule from "react";
import type * as TanStackRouter from "@tanstack/react-router";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { FileDropzone } from "@/components/FileDropzone";
import type { SessionData } from "@/lib/auth/client";

// SAFETY: These nullable fixture slots start empty and receive typed values during each test.
const mocks = vi.hoisted(() => ({
  session: { data: null as SessionData | null, isPending: false },
  refs: [{ current: null as string | null }, { current: false }],
  refIndex: 0,
  effect: null as (() => void) | null,
  auth: null as { mode?: string; onBeforeOpen?: () => void } | null,
  navigate: vi.fn(),
  invalidate: vi.fn(),
  clearCookie: vi.fn(),
  setUploadedKey: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
  onOpenChange: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  useCallback: (callback: (key: string) => Promise<void>) => callback,
  useEffect: (callback: () => void) => {
    mocks.effect = callback;
  },
  useRef: () => mocks.refs[mocks.refIndex++],
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof TanStackRouter>()),
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ invalidate: mocks.invalidate }),
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => mocks.session,
  SignInButton: ({
    children,
    ...props
  }: {
    children: ReactNode;
    mode?: string;
    onBeforeOpen?: () => void;
  }) => {
    mocks.auth = props;

    return children;
  },
}));

vi.mock("@/hooks/useFileUpload", () => ({
  useFileUpload: () => ({
    file: { name: "resume.pdf" },
    uploadedKey: "temp/upload/resume.pdf",
    uploadState: "claiming",
    error: null,
    setUploadedKey: mocks.setUploadedKey,
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? children : null),
  DialogContent: ({ children }: { children: ReactNode }) =>
    createElement("div", { role: "dialog" }, children),
  DialogHeader: ({ children }: { children: ReactNode }) => children,
  DialogTitle: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/lib/utils/pending-upload-client", () => ({
  clearPendingUploadCookie: mocks.clearCookie,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function render(open: boolean): string {
  mocks.refIndex = 0;

  return renderToStaticMarkup(FileDropzone({ open, onOpenChange: mocks.onOpenChange }));
}

function signIn(): void {
  mocks.session.data = {
    user: { id: "user_1", name: "Avery", email: "avery@example.com", image: null },
    session: { id: "session_1", userId: "clerk_1" },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.refs[0]!.current = null;
  mocks.refs[1]!.current = false;
  mocks.session.data = null;
  mocks.session.isPending = false;
  mocks.effect = null;
  mocks.auth = null;
  mocks.clearCookie.mockResolvedValue(undefined);
  mocks.navigate.mockResolvedValue(undefined);
  mocks.fetch.mockResolvedValue(Response.json({ resume_id: "resume_1" }));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("upload authentication handoff", () => {
  it("closes the upload before sign-up, retaining the file and CTA if authentication is dismissed", () => {
    expect(render(true)).toContain("Sign up to publish");
    expect(mocks.auth?.mode).toBe("sign-up");

    mocks.auth?.onBeforeOpen?.();

    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
    expect(render(false)).not.toContain('role="dialog"');
    expect(render(true)).toContain("resume.pdf has been uploaded successfully.");
    expect(render(true)).toContain("Create a free account to publish.");
    expect(mocks.setUploadedKey).not.toHaveBeenCalled();
    expect(mocks.clearCookie).not.toHaveBeenCalled();
  });

  it("shows progress after authentication and hands the pending upload to the wizard without racing its claim", async () => {
    render(true);
    mocks.effect?.();
    mocks.auth?.onBeforeOpen?.();
    signIn();

    expect(render(false)).toContain("Saving your résumé. Opening the next step…");
    mocks.effect?.();

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/wizard", replace: true }),
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.clearCookie).not.toHaveBeenCalled();
  });

  it("keeps signed-in dashboard uploads on the existing claim and dashboard path", async () => {
    signIn();
    render(true);
    mocks.effect?.();
    mocks.effect?.();

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true }),
    );
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/resume/claim",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ key: "temp/upload/resume.pdf" }),
      }),
    );
    expect(mocks.clearCookie).toHaveBeenCalledOnce();
  });
});
