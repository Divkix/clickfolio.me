import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_PRIVACY_SETTINGS } from "@/lib/utils/privacy";

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  requireAdminAuthForApi: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerException: vi.fn(async () => {}),
  distinctIdFromCookieHeader: vi.fn(() => "ph-distinct-1"),
}));

import { captureServerException } from "@/lib/analytics/server";
import { requireAdminAuthForApi } from "@/lib/auth/admin";
import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { withAdmin, withUser } from "@/lib/auth/with-auth";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

const mockedAdminAuth = vi.mocked(requireAdminAuthForApi);

type AuthSuccess = Awaited<ReturnType<typeof requireAuthWithUserValidation>>;

type UserContext = Parameters<Parameters<typeof withUser>[1]>[0];

type AdminAuthSuccess = Awaited<ReturnType<typeof requireAdminAuthForApi>>;

type AdminContext = Parameters<Parameters<typeof withAdmin>[1]>[0];

function successResult(): AuthSuccess {
  return {
    user: {
      id: "user-1",
      email: "user-1@test.com",
      name: "Test User",
      image: null,
      handle: "testuser",
      headline: null,
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      onboardingCompleted: true,
      role: "mid_level",
    },
    // SAFETY: withUser forwards db by identity — the handler asserts ctx.db === result.db
    // and never queries it, and Database also requires the live postgres-js $client that
    // no test can construct — so a marker object stands in for the instance.
    db: { marker: "db" } as never,
    dbUser: { id: "user-1", handle: "testuser", clerkId: "user_2clerkAbc" },
    // SAFETY: the handler only compares ctx.env by identity and never reads a binding, so
    // the stub needs none of the 30 CloudflareEnv members beyond carrying HYPERDRIVE here.
    env: {
      HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
    } as never,
    error: null,
  };
}

function adminSuccessResult(): AdminAuthSuccess {
  return {
    user: {
      id: "admin-1",
      email: "admin-1@test.com",
      name: "Admin User",
      isAdmin: true,
    },
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withUser", () => {
  it("returns the auth error response and does not invoke the callback when auth fails", async () => {
    const authError = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    mockedAuth.mockResolvedValue({
      user: null,
      db: null,
      dbUser: null,
      env: null,
      error: authError,
    });

    const handler = vi.fn();
    const response = await withUser(new Request("http://localhost/api/test"), handler);

    expect(response).toBe(authError);
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the callback with a non-null context and returns its response on success", async () => {
    const result = successResult();
    mockedAuth.mockResolvedValue(result);

    const handlerResponse = new Response("ok", { status: 200 });

    const handler = vi.fn(async (ctx: UserContext) => {
      expect(ctx.user).toBe(result.user);
      expect(ctx.db).toBe(result.db);
      expect(ctx.dbUser).toBe(result.dbUser);
      expect(ctx.env).toBe(result.env);

      return handlerResponse;
    });

    const response = await withUser(new Request("http://localhost/api/test"), handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response).toBe(handlerResponse);
  });

  it("maps a thrown error to a standard 500 and logs the request path", async () => {
    mockedAuth.mockResolvedValue(successResult());
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = vi.fn(async () => {
      throw new Error("boom");
    });

    const response = await withUser(new Request("http://localhost/api/resume/update"), handler);

    expect(response.status).toBe(500);
    const body: { code?: string } = await response.json();
    expect(body.code).toBe("INTERNAL_ERROR");

    const loggedArgs = consoleSpy.mock.calls.flat();

    expect(loggedArgs).toContainEqual(expect.stringContaining("/api/resume/update"));

    consoleSpy.mockRestore();
  });

  it("reports a thrown error to PostHog Error Tracking with the request path", async () => {
    mockedAuth.mockResolvedValue(successResult());
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("claim blew up");

    const response = await withUser(
      new Request("http://localhost/api/resume/claim", { method: "POST" }),
      async () => {
        throw error;
      },
    );

    expect(response.status).toBe(500);
    expect(vi.mocked(captureServerException)).toHaveBeenCalledWith(
      error,
      { request_path: "/api/resume/claim", request_method: "POST" },
      "ph-distinct-1",
    );

    consoleSpy.mockRestore();
  });

  it("maps a thrown error during the auth check itself to a 500", async () => {
    mockedAuth.mockRejectedValue(new Error("auth blew up"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = vi.fn();
    const response = await withUser(new Request("http://localhost/api/test"), handler);

    expect(response.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("passes a custom unauthorized message through to the auth check", async () => {
    mockedAuth.mockResolvedValue(successResult());
    const handler = vi.fn(async () => new Response("ok"));

    await withUser(new Request("http://localhost/api/test"), handler, "Custom login required");

    expect(mockedAuth).toHaveBeenCalledWith("Custom login required");
  });
});

describe("withAdmin", () => {
  it("returns the auth error response and does not invoke the callback when admin auth fails", async () => {
    const authError = new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
    });

    mockedAdminAuth.mockResolvedValue({ user: null, error: authError });

    const handler = vi.fn();
    const response = await withAdmin(new Request("http://localhost/api/admin/stats"), handler);

    expect(response).toBe(authError);
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the callback with a non-null admin context and returns its response on success", async () => {
    const result = adminSuccessResult();
    mockedAdminAuth.mockResolvedValue(result);

    const handlerResponse = new Response("ok", { status: 200 });

    const handler = vi.fn(async (ctx: AdminContext) => {
      expect(ctx.user).toBe(result.user);

      return handlerResponse;
    });

    const response = await withAdmin(new Request("http://localhost/api/admin/stats"), handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response).toBe(handlerResponse);
  });

  it("maps a thrown error to a standard 500 and logs the request path", async () => {
    mockedAdminAuth.mockResolvedValue(adminSuccessResult());
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = vi.fn(async () => {
      throw new Error("boom");
    });

    const response = await withAdmin(new Request("http://localhost/api/admin/referrals"), handler);

    expect(response.status).toBe(500);
    const body: { code?: string } = await response.json();
    expect(body.code).toBe("INTERNAL_ERROR");

    const loggedArgs = consoleSpy.mock.calls.flat();

    expect(loggedArgs).toContainEqual(expect.stringContaining("/api/admin/referrals"));

    consoleSpy.mockRestore();
  });

  it("maps a thrown error during the admin auth check itself to a 500", async () => {
    mockedAdminAuth.mockRejectedValue(new Error("auth blew up"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = vi.fn();
    const response = await withAdmin(new Request("http://localhost/api/admin/stats"), handler);

    expect(response.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("supports a param-less handler (undefined request) and still maps a throw to 500", async () => {
    mockedAdminAuth.mockResolvedValue(adminSuccessResult());
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = vi.fn(async () => {
      throw new Error("boom");
    });

    const response = await withAdmin(undefined, handler);

    expect(response.status).toBe(500);

    consoleSpy.mockRestore();
  });
});
