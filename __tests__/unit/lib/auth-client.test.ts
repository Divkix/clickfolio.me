import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  signIn,
  signOut,
  signUp,
  useSession,
} from "@/lib/auth/client";

const mocks = vi.hoisted(() => {
  const authClient = {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    useSession: vi.fn(),
    sendVerificationEmail: vi.fn(),
  };

  return {
    authClient,
    createAuthClient: vi.fn((_config: unknown) => authClient),
  };
});

vi.mock("better-auth/react", () => ({
  createAuthClient: (config: unknown) => mocks.createAuthClient(config),
}));

describe("auth client helpers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("creates the Better Auth client with the browser origin and re-exports auth helpers", () => {
    expect(mocks.createAuthClient).toHaveBeenCalledWith({ baseURL: "http://localhost:3000" });
    expect(signIn).toBe(mocks.authClient.signIn);
    expect(signUp).toBe(mocks.authClient.signUp);
    expect(signOut).toBe(mocks.authClient.signOut);
    expect(resetPassword).toBe(mocks.authClient.resetPassword);
    expect(useSession).toBe(mocks.authClient.useSession);
    expect(sendVerificationEmail).toBe(mocks.authClient.sendVerificationEmail);
  });

  it("returns password reset success data", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ message: "Check your inbox" }));

    await expect(
      requestPasswordReset({ email: "avery@example.com", redirectTo: "/reset-password" }),
    ).resolves.toEqual({
      data: { message: "Check your inbox" },
      error: null,
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/request-password-reset",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "avery@example.com",
          redirectTo: "/reset-password",
        }),
      }),
    );
  });

  it("returns API error messages and status fallbacks", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ message: "No account found" }, { status: 404 }))
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: vi.fn(async () => {
          throw new Error("invalid json");
        }),
      } as unknown as Response);

    const missing = await requestPasswordReset({ email: "missing@example.com" });
    expect(missing.data).toBeNull();
    expect(missing.error?.message).toBe("No account found");

    const unavailable = await requestPasswordReset({ email: "avery@example.com" });
    expect(unavailable.data).toBeNull();
    expect(unavailable.error?.message).toBe("Request failed with status 503");
  });

  it("normalizes thrown password reset failures", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce("blocked");

    const network = await requestPasswordReset({ email: "avery@example.com" });
    expect(network.data).toBeNull();
    expect(network.error?.message).toBe("network down");

    const unknown = await requestPasswordReset({ email: "avery@example.com" });
    expect(unknown.data).toBeNull();
    expect(unknown.error?.message).toBe("Unknown error");
  });
});
