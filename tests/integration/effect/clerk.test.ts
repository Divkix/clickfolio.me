import { generateKeyPairSync, sign, webcrypto } from "node:crypto";
import type * as ClerkBackend from "@clerk/backend";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { describeFailure } from "@/lib/effect/failure-map";
import { ClerkFailed } from "@/lib/effect/failures";
import { Clerk } from "@/lib/effect/services/clerk";
import { logLines } from "../../helpers/log-lines";

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }));

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(() => ({ users: { deleteUser } })),
}));

const mockVerifyToken = vi.mocked(verifyToken);
const mockCreateClerkClient = vi.mocked(createClerkClient);

// What @clerk/backend throws: a TokenVerificationError carries a `reason`.
function clerkError(reason: string): Error {
  return Object.assign(new Error(`Clerk said ${reason}`), { reason });
}

const SECRET = "sk_test_clickfolio_secret";

// SAFETY: the Clerk layer reads only the secret and app URL; other bindings are unused.
const env = { CLERK_SECRET_KEY: SECRET, APP_URL: "https://clickfolio.me" } as CloudflareEnv;

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
  vi.unstubAllGlobals();
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
    expect(mockVerifyToken).toHaveBeenCalledWith("jwt", {
      secretKey: SECRET,
      authorizedParties: ["https://clickfolio.me"],
    });
  });

  it("accepts localhost azp and rejects another origin with the installed SDK", async () => {
    vi.stubGlobal("crypto", webcrypto);

    const sdk = await vi.importActual<typeof ClerkBackend>("@clerk/backend");
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwtKey = publicKey.export({ type: "spki", format: "pem" }).toString();
    const now = Math.floor(Date.now() / 1000);

    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test" })).toString(
      "base64url",
    );

    const payload = Buffer.from(
      JSON.stringify({
        sub: "user_local",
        azp: "http://localhost:3000",
        iss: "https://local.clerk.accounts.dev",
        iat: now,
        nbf: now - 1,
        exp: now + 60,
      }),
    ).toString("base64url");

    const unsigned = `${header}.${payload}`;
    const token = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;

    await expect(
      sdk.verifyToken(token, { jwtKey, authorizedParties: ["http://localhost:3000"] }),
    ).resolves.toMatchObject({ sub: "user_local" });
    await expect(
      sdk.verifyToken(token, { jwtKey, authorizedParties: ["https://clickfolio.me"] }),
    ).rejects.toMatchObject({ reason: "token-invalid-authorized-parties" });
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
    "token-invalid-authorized-parties",
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

  it("fails with a non-retryable ClerkFailed, without calling Clerk, when the secret key is missing", async () => {
    const failure = await verifyFailure("jwt", envWithoutSecret);

    expect(failure).toBeInstanceOf(ClerkFailed);
    expect(failure).toMatchObject({ kind: "rejected", operation: "clerk.verify-token" });
    expect(failure.message).toContain("CLERK_SECRET_KEY is not configured");
    expect(describeFailure(failure)).toMatchObject({ status: 500, retryable: false });
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it.each([undefined, "not a URL"])("fails closed with APP_URL=%s", async (appUrl) => {
    vi.stubEnv("APP_URL", "");

    try {
      const failure = await verifyFailure("jwt", { ...env, APP_URL: appUrl ?? "" });

      expect(failure).toMatchObject({ kind: "rejected", operation: "clerk.verify-token" });
      expect(describeFailure(failure)).toMatchObject({ status: 500, retryable: false });
      expect(mockVerifyToken).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
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

function remove(clerkId: string, layerEnv: CloudflareEnv = env) {
  return Effect.runPromise(
    Effect.provide(
      Clerk.use((clerk) => clerk.deleteUser(clerkId)),
      Clerk.layer(layerEnv),
    ),
  );
}

function removeFailure(clerkId: string, layerEnv: CloudflareEnv = env) {
  return Effect.runPromise(
    Effect.provide(
      Effect.flip(Clerk.use((clerk) => clerk.deleteUser(clerkId))),
      Clerk.layer(layerEnv),
    ),
  );
}

describe("Clerk.deleteUser", () => {
  it("deletes the identity with the configured secret key", async () => {
    deleteUser.mockResolvedValue({});

    await expect(remove("user_abc")).resolves.toBeUndefined();
    expect(mockCreateClerkClient).toHaveBeenCalledWith({ secretKey: SECRET });
    expect(deleteUser).toHaveBeenCalledWith("user_abc");
  });

  it("treats a user Clerk no longer has (404) as deleted", async () => {
    deleteUser.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));

    await expect(remove("user_abc")).resolves.toBeUndefined();
  });

  it("fails with a retryable ClerkFailed when Clerk answers 503", async () => {
    deleteUser.mockRejectedValue(Object.assign(new Error("unavailable"), { status: 503 }));

    const failure = await removeFailure("user_abc");

    expect(failure).toBeInstanceOf(ClerkFailed);
    expect(failure).toMatchObject({ operation: "clerk.delete-user" });
    expect(describeFailure(failure)).toMatchObject({ retryable: true });
  });

  it("fails with ClerkFailed on any other refusal", async () => {
    deleteUser.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));

    expect(await removeFailure("user_abc")).toBeInstanceOf(ClerkFailed);
  });

  it("fails non-retryable, without creating a client, when the secret key is missing", async () => {
    const failure = await removeFailure("user_abc", envWithoutSecret);

    expect(failure).toBeInstanceOf(ClerkFailed);
    expect(failure.message).toContain("CLERK_SECRET_KEY is not configured");
    expect(describeFailure(failure)).toMatchObject({ status: 500, retryable: false });
    expect(mockCreateClerkClient).not.toHaveBeenCalled();
  });

  it("fails with a timeout when Clerk never answers", async () => {
    vi.useFakeTimers();
    deleteUser.mockReturnValue(new Promise<never>(() => {}));

    const pending = removeFailure("user_abc");

    await vi.advanceTimersByTimeAsync(8_001);

    const failure = await pending;

    expect(failure).toMatchObject({ kind: "timeout" });
    expect(describeFailure(failure)).toMatchObject({ status: 504 });
  });
});
