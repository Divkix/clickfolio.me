import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { decideWizardStart, runClaimThenLoad } from "@/lib/wizard/initial-step";
import { INDEXABLE_CONTENT } from "../helpers/pglite-db";

const { clearCookie, waitForCompletion } = vi.hoisted(() => ({
  clearCookie: vi.fn<() => Promise<void>>(),
  waitForCompletion:
    vi.fn<(resumeId: string) => Promise<{ status: "completed" | "failed"; error?: string }>>(),
}));

vi.mock("@/lib/utils/pending-upload-client", () => ({
  clearPendingUploadCookie: clearCookie,
}));

vi.mock("@/lib/utils/wait-for-completion", () => ({
  waitForResumeCompletion: waitForCompletion,
}));

const pendingUpload = { key: "temp/new-resume.pdf", file_hash: null };

beforeEach(() => {
  vi.resetAllMocks();
  clearCookie.mockResolvedValue(undefined);
  waitForCompletion.mockResolvedValue({ status: "completed" });
});

describe("wizard initial step precedence", () => {
  it("claims a pending upload before using an existing site's content", () => {
    expect(
      decideWizardStart({ pendingUpload, siteContent: INDEXABLE_CONTENT, latestStatus: null }),
    ).toEqual({ kind: "claim-first", pendingUpload });
  });

  it("claims a pending upload instead of redirecting for an older processing resume", () => {
    expect(
      decideWizardStart({
        pendingUpload,
        siteContent: null,
        latestStatus: { id: "older", status: "processing" },
      }),
    ).toEqual({ kind: "claim-first", pendingUpload });
  });

  it("preloads existing content when there is no pending upload", () => {
    expect(
      decideWizardStart({
        pendingUpload: null,
        siteContent: INDEXABLE_CONTENT,
        latestStatus: { id: "older", status: "processing" },
      }),
    ).toEqual({ kind: "review", content: INDEXABLE_CONTENT });
  });

  it("redirects a processing resume when there is no pending upload or content", () => {
    expect(
      decideWizardStart({
        pendingUpload: null,
        siteContent: null,
        latestStatus: { id: "latest", status: "processing" },
      }),
    ).toEqual({ kind: "redirect-waiting", resumeId: "latest" });
  });

  it("starts at upload when nothing exists", () => {
    expect(
      decideWizardStart({ pendingUpload: null, siteContent: null, latestStatus: null }),
    ).toEqual({ kind: "upload" });
  });
});

describe("client claim then refetch", () => {
  it("POSTs the claim and uses content fetched after parsing, never preloaded old content", async () => {
    const freshContent = { ...INDEXABLE_CONTENT, full_name: "Freshly parsed resume" };
    const calls: string[] = [];

    const start = decideWizardStart({
      pendingUpload,
      siteContent: INDEXABLE_CONTENT,
      latestStatus: { id: "older", status: "processing" },
    });

    const fetchImpl = vi.fn<typeof fetch>();

    fetchImpl.mockImplementation(async (input, init) => {
      calls.push(String(input));

      if (input === "/api/resume/claim") {
        expect(init).toMatchObject({ method: "POST", body: JSON.stringify(pendingUpload) });

        return Response.json({ resume_id: "new", cached: false });
      }

      expect(clearCookie).toHaveBeenCalledOnce();
      expect(waitForCompletion).toHaveBeenCalledWith("new");

      return Response.json({ content: freshContent });
    });
    waitForCompletion.mockImplementation(async () => {
      calls.push("parsing completed");

      return { status: "completed" };
    });

    if (start.kind !== "claim-first") throw new Error("Expected claim-first");

    expect(await runClaimThenLoad(start.pendingUpload, fetchImpl)).toEqual({
      kind: "review",
      content: freshContent,
    });
    expect(calls).toEqual(["/api/resume/claim", "parsing completed", "/api/site-data"]);
  });

  it("uses cached claims without waiting for parsing", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(Response.json({ resume_id: "cached", cached: true }));
    fetchImpl.mockResolvedValueOnce(Response.json({ content: INDEXABLE_CONTENT }));

    expect(await runClaimThenLoad(pendingUpload, fetchImpl)).toEqual({
      kind: "review",
      content: INDEXABLE_CONTENT,
    });
    expect(clearCookie).toHaveBeenCalledOnce();
    expect(waitForCompletion).not.toHaveBeenCalled();
  });

  it("keeps the status fallback when the fresh site has no content", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(Response.json({ resume_id: "new", cached: true }));
    fetchImpl.mockResolvedValueOnce(Response.json(null));
    fetchImpl.mockResolvedValueOnce(Response.json({ id: "new", status: "processing" }));

    expect(await runClaimThenLoad(pendingUpload, fetchImpl)).toEqual({
      kind: "redirect-waiting",
      resumeId: "new",
    });
  });

  it("does not load content after a failed claim", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(Response.json({ error: "Claim failed" }, { status: 500 }));

    await expect(runClaimThenLoad(pendingUpload, fetchImpl)).rejects.toThrow("Claim failed");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not load content when parsing fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(Response.json({ resume_id: "new" }));
    waitForCompletion.mockResolvedValue({ status: "failed", error: "Invalid PDF" });

    await expect(runClaimThenLoad(pendingUpload, fetchImpl)).rejects.toThrow("Invalid PDF");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
