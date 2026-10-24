import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { Db } from "@/lib/effect/db";
import { Mailer } from "@/lib/effect/services/mailer";
import { resumeFailureEmail, resumeFailureEmailBestEffort } from "@/lib/parse/email";

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

// SAFETY: getDb is mocked, so the binding is never read.
const HYPERDRIVE = {} as CloudflareEnv["HYPERDRIVE"];

const CONFIG = { appUrl: "https://clickfolio.me/", from: "notifications@clickfolio.me" };

function layer(timeoutMs?: number) {
  return Layer.mergeAll(Db.layer(HYPERDRIVE), Mailer.layerFrom({ send: mocks.send }, timeoutMs));
}

function sendEmail(resumeId: string, config = CONFIG, timeoutMs?: number) {
  return Effect.runPromise(
    Effect.provide(resumeFailureEmailBestEffort(resumeId, config), layer(timeoutMs)),
  );
}

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

describe("resumeFailureEmail", () => {
  it("emails the persisted verified account owner with a dashboard link", async () => {
    await expect(
      Effect.runPromise(Effect.provide(resumeFailureEmail("resume-1", CONFIG), layer())),
    ).resolves.toBe("sent");

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
    mocks.resume.mockResolvedValue({ userId: "actual-owner", status });

    await expect(
      Effect.runPromise(Effect.provide(resumeFailureEmail("resume-1", CONFIG), layer())),
    ).resolves.toBe("skipped");

    expect(mocks.owner).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("skips deleted resumes and deleted owners", async () => {
    mocks.resume.mockResolvedValueOnce(undefined);
    await sendEmail("deleted-resume");
    mocks.owner.mockResolvedValueOnce(undefined);
    await sendEmail("resume-1");

    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each([
    { emailVerified: false, clerkId: "clerk-owner" },
    { emailVerified: null, clerkId: "clerk-owner" },
    { emailVerified: true, clerkId: null },
  ])("skips unverified or anonymous owners: %j", async (owner) => {
    mocks.owner.mockResolvedValue({ email: "account@example.com", ...owner });
    await sendEmail("resume-1");

    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("resumeFailureEmailBestEffort", () => {
  it.each(["lookup", "send"] as const)(
    "absorbs %s errors without logging recipient details",
    async (operation) => {
      const error = new Error("Provider details: account@example.com");

      if (operation === "lookup") mocks.owner.mockRejectedValue(error);
      else mocks.send.mockRejectedValue(error);

      await expect(sendEmail("resume-1")).resolves.toBeUndefined();
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

  it("logs a send that hangs as a timeout with an unknown outcome, and never sends again", async () => {
    mocks.send.mockReturnValue(new Promise<EmailSendResult>(() => {}));

    await sendEmail("resume-1", CONFIG, 20);

    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "resume failure email failed",
      expect.objectContaining({
        resumeId: "resume-1",
        failure: "EmailFailed",
        operation: "email.send",
        kind: "timeout",
        outcome_unknown: true,
      }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("account@example.com");
  });

  it("sends once even when the provider rejects", async () => {
    mocks.send.mockRejectedValue(new Error("provider down"));

    await sendEmail("resume-1");

    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("does not send with a bad APP_URL, and lets the step log the defect", async () => {
    await expect(sendEmail("resume-1", { ...CONFIG, appUrl: "not a url" })).rejects.toThrow();

    expect(mocks.send).not.toHaveBeenCalled();
  });
});
