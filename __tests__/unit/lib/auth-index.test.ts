import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

type EmailSendResult = {
  success: boolean;
  error?: string;
};

const originalEnv = {
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv(key: keyof typeof originalEnv) {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const value = originalEnv[key];
  if (value === undefined) {
    delete mutableEnv[key];
    return;
  }
  mutableEnv[key] = value;
}

const mocks = vi.hoisted(() => {
  class APIError extends Error {
    status: string;

    constructor(status: string, init: { message: string }) {
      super(init.message);
      this.status = status;
    }
  }

  const env = {
    CLICKFOLIO_DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn((...args: unknown[]) => ({ args })),
        first: vi.fn(),
      })),
    },
    BETTER_AUTH_URL: "https://clickfolio.me",
    BETTER_AUTH_SECRET: "secret",
    GOOGLE_CLIENT_ID: "google-id",
    GOOGLE_CLIENT_SECRET: "google-secret",
    CLICKFOLIO_DISPOSABLE_DOMAINS: {},
  };

  return {
    APIError,
    env,
    betterAuth: vi.fn((config: unknown) => ({ config, handler: vi.fn() })),
    drizzleAdapter: vi.fn((db: unknown, config: unknown) => ({ db, config })),
    drizzle: vi.fn((db: unknown, config: unknown) => ({ db, config })),
    isDisposableEmail: vi.fn(async (_email: string) => ({ disposable: false })),
    generateReferralCode: vi.fn(() => "REF123"),
    sendPasswordResetEmail: vi.fn(async (): Promise<EmailSendResult> => ({ success: true })),
    sendVerificationEmail: vi.fn(async (): Promise<EmailSendResult> => ({ success: true })),
  };
});

vi.mock("cloudflare:workers", () => ({
  env: mocks.env,
}));

vi.mock("better-auth", () => ({
  betterAuth: (config: unknown) => mocks.betterAuth(config),
}));

vi.mock("better-auth/api", () => ({
  APIError: mocks.APIError,
}));

vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: (db: unknown, config: unknown) => mocks.drizzleAdapter(db, config),
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: (db: unknown, config: unknown) => mocks.drizzle(db, config),
}));

vi.mock("@/lib/email/cloudflare", () => ({
  createEmailSender: () => ({
    sendPasswordResetEmail: mocks.sendPasswordResetEmail,
    sendVerificationEmail: mocks.sendVerificationEmail,
  }),
}));

vi.mock("@/lib/email/disposable-check", () => ({
  isDisposableEmail: (email: string) => mocks.isDisposableEmail(email),
}));

vi.mock("@/lib/utils/referral-code", () => ({
  generateReferralCode: () => mocks.generateReferralCode(),
}));

describe("server auth configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.NODE_ENV = "test";
    delete mutableEnv.BETTER_AUTH_SECRET;
    delete mutableEnv.GOOGLE_CLIENT_ID;
  });

  afterEach(() => {
    restoreEnv("BETTER_AUTH_SECRET");
    restoreEnv("GOOGLE_CLIENT_ID");
    restoreEnv("NODE_ENV");
  });

  it("reads environment values from bindings, process fallback, and throws when missing", async () => {
    const { getEnvValue } = await import("@/lib/auth");

    expect(getEnvValue({ BETTER_AUTH_URL: " https://local.test " }, "BETTER_AUTH_URL")).toBe(
      " https://local.test ",
    );
    process.env.BETTER_AUTH_SECRET = "process-secret";
    expect(getEnvValue({}, "BETTER_AUTH_SECRET")).toBe("process-secret");
    expect(() => getEnvValue({}, "GOOGLE_CLIENT_ID")).toThrow(
      "Missing required environment variable",
    );
  });

  it("builds and caches Better Auth while serializing D1 Date binds", async () => {
    const { getAuth } = await import("@/lib/auth");

    const first = await getAuth();
    const second = await getAuth();

    expect(first).toBe(second);
    expect(mocks.betterAuth).toHaveBeenCalledTimes(1);
    expect(mocks.drizzleAdapter).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ provider: "sqlite" }),
    );

    const wrappedD1 = mocks.drizzle.mock.calls[0][0] as D1Database;
    const stmt = wrappedD1.prepare("select ?");
    expect(stmt.bind(new Date("2026-05-20T00:00:00.000Z"), "x")).toEqual({
      args: ["2026-05-20T00:00:00.000Z", "x"],
    });
  });

  it("runs signup and email hooks with disposable, referral, and mail failure branches", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { getAuth } = await import("@/lib/auth");
      const auth = await getAuth();
      const config = auth.config;
      const beforeCreate = config.databaseHooks.user.create.before;

      await expect(beforeCreate({ email: "temp@example.com" })).resolves.toEqual({
        data: { email: "temp@example.com", referralCode: "REF123" },
      });

      mocks.isDisposableEmail.mockResolvedValueOnce({ disposable: true });
      await expect(beforeCreate({ email: "blocked@example.com" })).rejects.toBeInstanceOf(
        mocks.APIError,
      );

      mocks.isDisposableEmail.mockRejectedValueOnce(new Error("kv down"));
      mocks.generateReferralCode.mockImplementationOnce(() => {
        throw new Error("rng down");
      });
      await expect(beforeCreate({ email: "fallback@example.com" })).resolves.toEqual({
        data: { email: "fallback@example.com" },
      });

      mocks.sendPasswordResetEmail.mockResolvedValueOnce({ success: false, error: "mail down" });
      await config.emailAndPassword.sendResetPassword({
        user: { email: "avery@example.com", name: "Avery" },
        url: "https://clickfolio.me/reset",
      });

      mocks.sendVerificationEmail.mockResolvedValueOnce({ success: false, error: "mail down" });
      await config.emailVerification.sendVerificationEmail({
        user: { email: "avery@example.com", name: "Avery" },
        url: "https://clickfolio.me/verify",
      });

      expect(mocks.sendPasswordResetEmail).toHaveBeenCalled();
      expect(mocks.sendVerificationEmail).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
