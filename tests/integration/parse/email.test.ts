import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import type { ResumeStatus } from "@/lib/db/schema/resume";

const mocks = vi.hoisted(() => ({
  resume: vi.fn<() => Promise<{ userId: string; status: ResumeStatus } | undefined>>(),
  owner:
    vi.fn<
      () => Promise<
        { email: string; emailVerified: boolean | null; clerkId: string | null } | undefined
      >
    >(),
  send: vi.fn<(message: EmailMessage | EmailMessageBuilder) => Promise<EmailSendResult>>(),
  log: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    query: { resumes: { findFirst: mocks.resume }, user: { findFirst: mocks.owner } },
  }),
}));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

const ENV = {
  // SAFETY: getDb is mocked, so no database binding fields are read.
  HYPERDRIVE: {} as CloudflareEnv["HYPERDRIVE"],
  EMAIL: { send: mocks.send },
  EMAIL_FROM: "notifications@clickfolio.me",
  APP_URL: "https://clickfolio.me/",
} satisfies Pick<CloudflareEnv, "HYPERDRIVE" | "EMAIL" | "EMAIL_FROM" | "APP_URL">;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resume.mockResolvedValue({ userId: "actual-owner", status: "failed" });
  mocks.owner.mockResolvedValue({
    email: "account@example.com",
    emailVerified: true,
    clerkId: "clerk-owner",
  });
  mocks.send.mockResolvedValue({ messageId: "message-1" });
});

describe("sendResumeFailureEmail", () => {
  it("emails the persisted verified account owner with a dashboard link", async () => {
    const { sendResumeFailureEmail } = await import("@/lib/parse/email");
    await sendResumeFailureEmail("resume-1", ENV);

    expect(mocks.owner).toHaveBeenCalledWith({
      where: eq(user.id, "actual-owner"),
      columns: { email: true, emailVerified: true, clerkId: true },
    });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "account@example.com",
        from: "notifications@clickfolio.me",
        text: expect.stringContaining("https://clickfolio.me/dashboard"),
      }),
    );
    expect(mocks.log).toHaveBeenCalledWith("info", "resume failure email accepted", {
      resumeId: "resume-1",
      messageId: "message-1",
    });
  });

  it.each(["queued", "completed"] as const)("skips a resume that is now %s", async (status) => {
    const { sendResumeFailureEmail } = await import("@/lib/parse/email");
    mocks.resume.mockResolvedValue({ userId: "actual-owner", status });
    await sendResumeFailureEmail("resume-1", ENV);
    expect(mocks.owner).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("skips deleted resumes and deleted owners", async () => {
    const { sendResumeFailureEmail } = await import("@/lib/parse/email");
    mocks.resume.mockResolvedValueOnce(undefined);
    await sendResumeFailureEmail("deleted-resume", ENV);
    mocks.owner.mockResolvedValueOnce(undefined);
    await sendResumeFailureEmail("resume-1", ENV);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each([
    { emailVerified: false, clerkId: "clerk-owner" },
    { emailVerified: null, clerkId: "clerk-owner" },
    { emailVerified: true, clerkId: null },
  ])("skips unverified or anonymous owners: %j", async (owner) => {
    const { sendResumeFailureEmail } = await import("@/lib/parse/email");
    mocks.owner.mockResolvedValue({ email: "account@example.com", ...owner });
    await sendResumeFailureEmail("resume-1", ENV);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("skips absent email bindings without querying the database", async () => {
    const { sendResumeFailureEmail } = await import("@/lib/parse/email");
    await sendResumeFailureEmail("resume-1", { ...ENV, EMAIL: undefined });
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it.each(["lookup", "send"] as const)(
    "absorbs %s errors without logging recipient details",
    async (operation) => {
      const { sendResumeFailureEmail } = await import("@/lib/parse/email");
      const error = new Error("Provider details: account@example.com");

      if (operation === "lookup") mocks.owner.mockRejectedValue(error);
      else mocks.send.mockRejectedValue(error);

      await expect(sendResumeFailureEmail("resume-1", ENV)).resolves.toBeUndefined();
      expect(mocks.log).toHaveBeenCalledWith(
        "error",
        "resume failure email failed",
        expect.objectContaining({
          resumeId: "resume-1",
          "error.name": "Error",
          "error.message": "Provider details: [email]",
        }),
      );
      expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("account@example.com");
    },
  );
});
