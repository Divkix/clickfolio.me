import { verifyToken } from "@clerk/backend";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { describeFailure } from "@/lib/effect/failure-map";
import { ClerkFailed } from "@/lib/effect/failures";
import { Clerk } from "@/lib/effect/services/clerk";
import { logLines } from "../../helpers/log-lines";

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}));

const mockVerifyToken = vi.mocked(verifyToken);

// What @clerk/backend throws: a TokenVerificationError carries a `reason`.
function clerkError(reason: string): Error {
  return Object.assign(new Error(`Clerk said ${reason}`), { reason });
}

const SECRET = "sk_test_clickfolio_secret";

// SAFETY: only CLERK_SECRET_KEY is read by the Clerk layer; the rest of the environment is unused.
const env = { CLERK_SECRET_KEY: SECRET } as CloudflareEnv;

// SAFETY: same partial environment, with the secret deliberately absent.
const envWithoutSecret = {} as CloudflareEnv;

function verify(token: string, layerEnv: CloudflareEnv = env) {
  return Effect.runPromise(
    Effect.provide(
      Clerk.use((clerk) => clerk.verifyToken(token)),
      Clerk.layer(layerEnv),
    ),
  );
}

function verifyFailure(token: string, layerEnv: CloudflareEnv = env) {
  return Effect.runPromise(
    Effect.provide(
      Effect.flip(Clerk.use((clerk) => clerk.verifyToken(token))),
      Clerk.layer(layerEnv),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Clerk.verifyToken", () => {
  it("returns the claims of a valid token", async () => {
    mockVerifyToken.mockResolvedValue({
      __raw: "jwt",
      iss: "https://clerk.test",
      sub: "user_abc",
      sid: "sess_1",
      org_id: "org_1",
      nbf: 0,
      exp: 2_000_000_000,
      iat: 1_000_000_000,
    });

    await expect(verify("jwt")).resolves.toEqual({
      sub: "user_abc",
      sid: "sess_1",
      orgId: "org_1",
      exp: 2_000_000_000,
      iat: 1_000_000_000,
    });
    expect(mockVerifyToken).toHaveBeenCalledWith("jwt", { secretKey: SECRET });
  });

  it("answers an empty token with no session and no Clerk call", async () => {
    await expect(verify("", envWithoutSecret)).resolves.toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it.each([
    "token-expired",
    "token-invalid",
    "token-invalid-signature",
    "token-invalid-algorithm",
    "token-not-active-yet",
    "jwk-kid-mismatch",
  ])("treats a %s rejection as no session and warns", async (reason) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockVerifyToken.mockRejectedValue(clerkError(reason));

    await expect(verify("bad-jwt")).resolves.toBeNull();

    const [line] = logLines(warn);

    expect(line).toMatchObject({
      level: "warn",
      msg: "[clerk] session token verification failed",
    });
  });

  it("treats a verified payload without a subject as no session", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // SAFETY: Clerk's JwtPayload requires sub; this fixture is the malformed case on purpose.
    mockVerifyToken.mockResolvedValue({} as never);

    await expect(verify("jwt")).resolves.toBeNull();
  });

  it.each(["jwk-remote-failed-to-load", "jwk-remote-invalid", "jwk-remote-missing"])(
    "fails with a retryable ClerkFailed, not a sign-out, on %s",
    async (reason) => {
      mockVerifyToken.mockRejectedValue(clerkError(reason));

      const failure = await verifyFailure("jwt");

      expect(failure).toBeInstanceOf(ClerkFailed);
      expect(failure).toMatchObject({ kind: "unavailable", operation: "clerk.verify-token" });
      expect(describeFailure(failure)).toMatchObject({ status: 503, retryable: true });
    },
  );

  it("fails with ClerkFailed when the key-set fetch dies on the network", async () => {
    mockVerifyToken.mockRejectedValue(new TypeError("fetch failed"));

    const failure = await verifyFailure("jwt");

    expect(failure).toBeInstanceOf(ClerkFailed);
    expect(failure).toMatchObject({ kind: "unavailable" });
  });

  it.each(["secret-key-invalid", "jwk-failed-to-resolve", "jwk-local-missing"])(
    "fails with a non-retryable ClerkFailed on the %s configuration fault",
    async (reason) => {
      mockVerifyToken.mockRejectedValue(clerkError(reason));

      const failure = await verifyFailure("jwt");

      expect(failure).toBeInstanceOf(ClerkFailed);
      expect(describeFailure(failure)).toMatchObject({ status: 500, retryable: false });
    },
  );

  it("fails with ClerkFailed, without calling Clerk, when the secret key is missing", async () => {
    const failure = await verifyFailure("jwt", envWithoutSecret);

    expect(failure).toBeInstanceOf(ClerkFailed);
    expect(failure.message).toContain("CLERK_SECRET_KEY is not configured");
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("fails with a timeout when Clerk never answers", async () => {
    vi.useFakeTimers();
    mockVerifyToken.mockReturnValue(new Promise<never>(() => {}));

    const pending = verifyFailure("jwt");

    await vi.advanceTimersByTimeAsync(8_001);

    const failure = await pending;

    expect(failure).toBeInstanceOf(ClerkFailed);
    expect(failure).toMatchObject({ kind: "timeout" });
    expect(describeFailure(failure)).toMatchObject({ status: 504 });
  });

  it("lets a thrown framework signal unwind as a defect", async () => {
    const signal = Object.assign(new Error("DYNAMIC_SERVER_USAGE"), {
      digest: "DYNAMIC_SERVER_USAGE",
    });

    mockVerifyToken.mockRejectedValue(signal);

    await expect(verify("jwt")).rejects.toBe(signal);
  });
});
