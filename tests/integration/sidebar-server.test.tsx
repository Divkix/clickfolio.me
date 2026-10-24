import { Effect, Layer } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DbFailed } from "@/lib/effect/failures";

const mocks = vi.hoisted(() => ({ session: vi.fn(), log: vi.fn() }));

vi.mock("cloudflare:workers", () => ({ env: {} }));

vi.mock("@/lib/auth/session", () => ({ findSession: () => mocks.session() }));

vi.mock("@/lib/effect/layers", () => ({ appLayer: () => Layer.empty }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: null, isPending: true }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import ProtectedLayout from "@/app/(protected)/layout";

describe("server-loaded sidebar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the site and admin links before the client session loads", async () => {
    mocks.session.mockReturnValue(Effect.succeed({ user: { handle: "alice", isAdmin: true } }));
    const html = renderToStaticMarkup(await ProtectedLayout({ children: "Protected content" }));
    expect(html).toContain('href="/@alice"');
    expect(html).toContain('href="/admin"');
    expect(html).toContain("Protected content");
  });

  it("does not redirect signed-out visitors", async () => {
    mocks.session.mockReturnValue(Effect.succeed(null));
    const html = renderToStaticMarkup(await ProtectedLayout({ children: "Page owns auth" }));
    expect(html).toContain("Page owns auth");
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain("View Site");
  });

  it("logs database failures and still renders the page without profile links", async () => {
    mocks.session.mockReturnValue(
      Effect.fail(
        new DbFailed({
          operation: "auth.user",
          kind: "unavailable",
          message: "Database unavailable",
        }),
      ),
    );
    const html = renderToStaticMarkup(await ProtectedLayout({ children: "Still available" }));
    expect(html).toContain("Still available");
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain("View Site");
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "Unable to load sidebar profile",
      expect.any(Object),
    );
  });
});
