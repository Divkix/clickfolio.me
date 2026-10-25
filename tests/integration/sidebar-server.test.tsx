import type * as TanStackRouter from "@tanstack/react-router";
import { isRedirect } from "@tanstack/react-router";
import { Effect, Layer } from "effect";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DbFailed } from "@/lib/effect/failures";

const mocks = vi.hoisted(() => ({ session: vi.fn(), serverSession: vi.fn(), log: vi.fn() }));

vi.mock("cloudflare:workers", () => ({ env: {} }));

vi.mock("@/lib/auth/session", () => ({
  findSession: () => mocks.session(),
  getServerSession: () => mocks.serverSession(),
}));

vi.mock("@/lib/effect/layers", () => ({ appLayer: () => Layer.empty }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: null, isPending: true }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>();

  return {
    ...actual,
    useLocation: () => "/dashboard",
    useNavigate: () => vi.fn(),
    useRouter: () => ({ invalidate: vi.fn() }),
    Link: ({
      to,
      params,
      children,
    }: {
      to: string;
      params?: { handle: string };
      children: ReactNode;
    }) => <a href={params ? to.replace("{$handle}", params.handle) : to}>{children}</a>,
  };
});

import { SidebarLayout } from "@/components/dashboard/SidebarLayout";
import { sidebarPageData, waitingPageData } from "@/lib/data/owner-pages";

async function renderSidebar(children: ReactNode) {
  const data = await sidebarPageData();

  return renderToStaticMarkup(<SidebarLayout {...data}>{children}</SidebarLayout>);
}

describe("server-loaded sidebar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the site and admin links before the client session loads", async () => {
    mocks.session.mockReturnValue(Effect.succeed({ user: { handle: "alice", isAdmin: true } }));
    const html = await renderSidebar("Protected content");
    expect(html).toContain('href="/@alice"');
    expect(html).toContain('href="/admin"');
    expect(html).toContain("Protected content");
  });

  it("does not redirect signed-out visitors", async () => {
    mocks.session.mockReturnValue(Effect.succeed(null));
    const html = await renderSidebar("Page owns auth");
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
    const html = await renderSidebar("Still available");
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

describe("waiting page data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gates signed-out visitors before checking the resume id", async () => {
    mocks.serverSession.mockResolvedValue(null);
    await expect(waitingPageData(undefined)).rejects.toSatisfy(
      (cause: unknown) => isRedirect(cause) && cause.options.to === "/",
    );
  });

  it("redirects signed-in visitors without a resume id to the dashboard", async () => {
    mocks.serverSession.mockResolvedValue({ user: { id: "user-1" } });
    await expect(waitingPageData(undefined)).rejects.toSatisfy(
      (cause: unknown) => isRedirect(cause) && cause.options.to === "/dashboard",
    );
  });

  it("passes the resume id to the authenticated waiting page", async () => {
    mocks.serverSession.mockResolvedValue({ user: { id: "user-1" } });
    await expect(waitingPageData("resume-1")).resolves.toEqual({ resumeId: "resume-1" });
  });
});
