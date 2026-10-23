import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => {
  const order: string[] = [];
  let clerkError: Error | null = null;

  const db = {
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        order.push("db");
      }),
    })),
  };

  return {
    order,
    db,
    setClerkError: (error: Error | null) => {
      clerkError = error;
    },
    getClerkError: () => clerkError,
  };
});

const context = {
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    image: null,
    handle: "user",
    headline: null,
    privacySettings: {
      show_phone: false,
      show_address: false,
      hide_from_search: false,
      show_in_directory: true,
    },
    onboardingCompleted: true,
    role: null,
  },
  db: state.db,
  dbUser: { id: "user-1", handle: "user", clerkId: "clerk-1" },
  env: { CLERK_SECRET_KEY: "sk_test", CLICKFOLIO_R2_BUCKET: {} },
};

vi.mock("@/lib/auth/with-auth", () => ({
  withUser: vi.fn(async (_request: Request, handler: (ctx: typeof context) => Promise<Response>) =>
    handler(context),
  ),
}));

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(() => ({
    users: {
      deleteUser: vi.fn(async () => {
        const error = state.getClerkError();

        if (error) throw error;

        state.order.push("clerk");
      }),
    },
  })),
}));

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn(() => ({
    list: vi.fn(async () => ({ objects: [], truncated: false })),
  })),
  collectR2KeysForUser: vi.fn(async () => ["temp/key"]),
}));

vi.mock("@/lib/workflows/r2-delete", () => ({
  deleteR2Objects: vi.fn(async () => []),
  scheduleR2Deletion: vi.fn(async () => undefined),
}));

vi.mock("@/lib/seo/indexnow-runtime", () => ({
  notifyIndexNowForProfiles: vi.fn(),
}));

function deletionRequest(): Request {
  return new Request("https://clickfolio.me/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "user@example.com" }),
  });
}

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    state.order.length = 0;
    state.setClerkError(null);
  });

  it("deletes the Clerk identity before the local user row", async () => {
    // Static import would bind the route before the module mocks above apply.
    const { POST } = await import("@/app/api/account/delete/route");

    const response = await POST(deletionRequest());

    expect(response.status).toBe(200);
    expect(state.order).toEqual(["clerk", "db"]);
  });

  it("keeps the local account when Clerk deletion fails, so the request is retryable", async () => {
    state.setClerkError(new Error("clerk unavailable"));

    const { POST } = await import("@/app/api/account/delete/route");

    const response = await POST(deletionRequest());

    expect(response.status).toBe(503);
    expect(state.order).toEqual([]);
  });
});
