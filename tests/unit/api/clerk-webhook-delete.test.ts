import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Webhook } from "svix";
import type { JsonValue } from "@/lib/types/json";
import type { R2DeleteParams } from "@/lib/workflows/r2-delete";

interface WebhookState {
  mappedUser: JsonValue;
  selectResults: JsonValue[][];
  scheduled: R2DeleteParams[];
  deleteWhereCalls: JsonValue[];
}

const mocks = vi.hoisted(() => {
  const state: WebhookState = {
    mappedUser: null,
    selectResults: [],
    scheduled: [],
    deleteWhereCalls: [],
  };

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      then: vi.fn((resolve: (value: JsonValue[]) => void, reject?: (reason: Error) => void) =>
        Promise.resolve(state.selectResults.shift() ?? []).then(resolve, reject),
      ),
    };

    return chain;
  };

  const db = {
    query: { user: { findFirst: vi.fn(async () => state.mappedUser) } },
    select: vi.fn(() => createSelectChain()),
    delete: vi.fn(() => ({
      where: vi.fn(async (condition: JsonValue) => {
        state.deleteWhereCalls.push(condition);
      }),
    })),
  };

  const env = {
    CLERK_WEBHOOK_SECRET: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
    HYPERDRIVE: { connectionString: "postgres://test" },
    CLICKFOLIO_R2_DELETE_WORKFLOW: {
      create: vi.fn(async ({ params }: { params: R2DeleteParams }) => {
        state.scheduled.push(params);

        return { id: "r2-delete-1" };
      }),
    },
  };

  return { state, db, env };
});

vi.mock("cloudflare:workers", () => ({
  env: mocks.env,
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => mocks.db),
}));

function deletedUserEvent() {
  return {
    type: "user.deleted",
    data: { deleted: true, id: "user_clerk_1", object: "user" },
  };
}

async function postWebhook(event: JsonValue = deletedUserEvent()) {
  const body = JSON.stringify(event);
  const svixId = "msg_test_1";
  const timestamp = new Date();
  const signature = new Webhook(mocks.env.CLERK_WEBHOOK_SECRET).sign(svixId, timestamp, body);
  const { POST } = await import("@/app/api/webhooks/clerk/route");

  return POST(
    new Request("https://clickfolio.me/api/webhooks/clerk", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
        "svix-signature": signature,
      },
    }),
  );
}

describe("POST /api/webhooks/clerk — user.deleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.mappedUser = { id: "user_1", clerkId: "user_clerk_1" };
    mocks.state.selectResults = [];
    mocks.state.scheduled = [];
    mocks.state.deleteWhereCalls = [];
  });

  it("hands the user's R2 keys and prefix to R2DeleteWorkflow before cascading the account away", async () => {
    mocks.state.selectResults = [
      [{ r2Key: "users/user_1/resume-1/cv.pdf" }, { r2Key: "users/user_1/1712345678901/cv.pdf" }],
    ];

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, action: "deleted" });
    expect(mocks.state.scheduled).toHaveLength(1);
    const [scheduled] = mocks.state.scheduled;
    expect([...scheduled.keys].sort()).toEqual([
      "users/user_1/1712345678901/cv.pdf",
      "users/user_1/resume-1/cv.pdf",
    ]);
    expect(scheduled.prefix).toBe("users/user_1/");
    expect(mocks.env.CLICKFOLIO_R2_DELETE_WORKFLOW.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.db.delete.mock.invocationCallOrder[0],
    );
    expect(mocks.state.deleteWhereCalls).toHaveLength(1);
  });

  it("deletes the account without scheduling R2 cleanup when no user row maps", async () => {
    mocks.state.mappedUser = null;

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(mocks.state.scheduled).toHaveLength(0);
    expect(mocks.state.deleteWhereCalls).toHaveLength(1);
  });
});
