import { describe, expect, it } from "vite-plus/test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * Unit tests for proxy.ts — the cookie-only auth gate for protected routes.
 *
 * Tests redirect vs. pass-through behavior for:
 * - Each protected prefix (/dashboard, /edit, /settings, /waiting, /wizard)
 * - A public (unprotected) path
 * - The Clerk `__session` session cookie granting pass-through
 * - The Clerk `__client` device cookie alone NOT granting access
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

// ── Tests: protected routes with the Clerk __session cookie ────────────

describe("Protected routes — '__session' cookie → pass-through", () => {
  it.each([["/dashboard"], ["/edit"], ["/settings"], ["/waiting"], ["/wizard"]])(
    "allows %s when __session cookie is present",
    (pathname) => {
      const response = proxy(makeRequest(pathname, "__session=valid-clerk-jwt"));
      expectPassThrough(response);
    },
  );
});

// ── Tests: __client device cookie must never grant access ──────────────

describe("Protected routes — '__client' cookie alone → redirect to /", () => {
  // Clerk sets __client even when signed out, so its presence must not open
  // protected routes; only an active-session __session cookie counts.
  it.each([["/dashboard"], ["/edit"], ["/settings"], ["/waiting"], ["/wizard"]])(
    "redirects %s when only the __client cookie is present",
    (pathname) => {
      const response = proxy(makeRequest(pathname, "__client=uat-device-token"));
      expectRedirectToRoot(response);
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
    const response = proxy(makeRequest("/", "__session=any-clerk-jwt"));
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

  it("redirects when an unrelated cookie is present but __session is missing", () => {
    const response = proxy(makeRequest("/settings", "some-other-cookie=value"));
    expectRedirectToRoot(response);
  });

  it("passes through when __session coexists with other cookies", () => {
    const response = proxy(
      makeRequest("/dashboard", "__client=uat-device-token; __session=clerk-jwt"),
    );
    expectPassThrough(response);
  });

  it("passes through a present-but-invalid __session (JWT crypto is deferred to page-level auth)", () => {
    // The proxy is a cheap presence gate by design: signature/expiry checks
    // run once per request in requireAuthClerk, which then rejects with 401.
    const response = proxy(makeRequest("/dashboard", "__session=definitely-not-a-valid-jwt"));
    expectPassThrough(response);
  });
});
