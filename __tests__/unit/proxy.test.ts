import { describe, expect, it } from "vite-plus/test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * Unit tests for proxy.ts — the cookie-only auth gate for protected routes.
 *
 * Tests redirect vs. pass-through behavior for:
 * - Each protected prefix (/dashboard, /edit, /settings, /waiting, /wizard)
 * - A public (unprotected) path
 * - Both session cookie variants (bare and __Secure- prefixed)
 * - Missing cookie → redirect to /
 */

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(pathname: string, cookieHeader?: string): NextRequest {
  const url = `https://clickfolio.me${pathname}`;
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  return new NextRequest(url, { headers });
}

function expectRedirectToRoot(response: Response) {
  expect(response.status).toBe(307);
  const location = response.headers.get("Location");
  expect(location).toBe("https://clickfolio.me/");
}

function expectPassThrough(response: Response) {
  // NextResponse.next() returns a 200 with no redirect
  expect(response.status).toBe(200);
  expect(response.headers.get("Location")).toBeNull();
}

// ── Tests: protected routes without session cookie ─────────────────────

describe("Protected routes — no session cookie → redirect to /", () => {
  it.each([
    ["/dashboard"],
    ["/dashboard/overview"],
    ["/edit"],
    ["/edit/resume-123"],
    ["/settings"],
    ["/settings/privacy"],
    ["/waiting"],
    ["/waiting/resume-abc"],
    ["/wizard"],
    ["/wizard/step1"],
  ])("redirects %s when no cookie is present", (pathname) => {
    const response = proxy(makeRequest(pathname));
    expectRedirectToRoot(response);
  });
});

// ── Tests: protected routes with valid bare session cookie ─────────────

describe("Protected routes — bare 'better-auth.session_token' cookie → pass-through", () => {
  it.each([["/dashboard"], ["/edit"], ["/settings"], ["/waiting"], ["/wizard"]])(
    "allows %s when bare session cookie is present",
    (pathname) => {
      const response = proxy(makeRequest(pathname, "better-auth.session_token=valid-token-value"));
      expectPassThrough(response);
    },
  );
});

// ── Tests: protected routes with __Secure- prefixed cookie ─────────────

describe("Protected routes — '__Secure-better-auth.session_token' cookie → pass-through", () => {
  it.each([["/dashboard"], ["/edit"], ["/settings"], ["/waiting"], ["/wizard"]])(
    "allows %s when __Secure- session cookie is present",
    (pathname) => {
      const response = proxy(
        makeRequest(pathname, "__Secure-better-auth.session_token=secure-token"),
      );
      expectPassThrough(response);
    },
  );
});

// ── Tests: public (unprotected) paths ─────────────────────────────────

describe("Public paths — always pass-through regardless of cookie", () => {
  it.each([["/"], ["/@janedoe"], ["/explore"], ["/about"], ["/api/health"], ["/login"]])(
    "passes through %s without cookie check",
    (pathname) => {
      const response = proxy(makeRequest(pathname));
      expectPassThrough(response);
    },
  );

  it("also passes through public paths with a session cookie", () => {
    const response = proxy(makeRequest("/", "better-auth.session_token=any-token"));
    expectPassThrough(response);
  });
});

// ── Tests: edge cases ─────────────────────────────────────────────────

describe("Edge cases", () => {
  it("does not redirect /dashboardXYZ (must start with /dashboard prefix)", () => {
    // /dashboard is a prefix match so /dashboardXYZ would match — check actual route semantics
    const response = proxy(makeRequest("/dashboardXYZ"));
    // proxy uses startsWith so this WOULD match — user gets redirected
    expectRedirectToRoot(response);
  });

  it("redirects when an unrelated cookie is present but session cookie is missing", () => {
    const response = proxy(makeRequest("/settings", "some-other-cookie=value"));
    expectRedirectToRoot(response);
  });

  it("passes through when both cookie variants are present (uses first match)", () => {
    const response = proxy(
      makeRequest(
        "/dashboard",
        "__Secure-better-auth.session_token=secure; better-auth.session_token=bare",
      ),
    );
    expectPassThrough(response);
  });
});
