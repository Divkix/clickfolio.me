import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

/**
 * Unit tests for the authenticated-route wrappers (ADR-0002 inner-callback form).
 *
 * The wrapper delegates auth to the existing `requireAuthWithUserValidation`
 * primitive (mocked here) and owns: returning the auth-failure response,
 * invoking the callback with a guaranteed-non-null context, and the catch-all
 * 500 (with the request path logged).
 */

vi.mock("@/lib/auth/middleware", () => ({
  requireAuthWithUserValidation: vi.fn(),
}));

import { requireAuthWithUserValidation } from "@/lib/auth/middleware";
import { withUser } from "@/lib/auth/with-auth";

const mockedAuth = vi.mocked(requireAuthWithUserValidation);

type AuthSuccess = Awaited<ReturnType<typeof requireAuthWithUserValidation>>;
type UserContext = Parameters<Parameters<typeof withUser>[1]>[0];

function successResult(): AuthSuccess {
  return {
    user: {
      id: "user-1",
      email: "user-1@test.com",
      name: "Test User",
      image: null,
      handle: "testuser",
      headline: null,
      privacySettings: "{}",
      onboardingCompleted: true,
      role: "mid_level",
    },
    db: { marker: "db" } as never,
    captureBookmark: vi.fn().mockResolvedValue(undefined),
    dbUser: { id: "user-1", handle: "testuser" },
    env: { CLICKFOLIO_DB: {} } as never,
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
      captureBookmark: null,
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
      // Context is guaranteed non-null and carries the full auth result.
      expect(ctx.user).toBe(result.user);
      expect(ctx.db).toBe(result.db);
      expect(ctx.captureBookmark).toBe(result.captureBookmark);
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
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("INTERNAL_ERROR");

    const loggedWithPath = consoleSpy.mock.calls.some((call: unknown[]) =>
      call.some((arg: unknown) => typeof arg === "string" && arg.includes("/api/resume/update")),
    );
    expect(loggedWithPath).toBe(true);

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
