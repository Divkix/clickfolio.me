import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { logLines } from "../../helpers/log-lines";

const SECRET = `whsec_${btoa("clickfolio-test-webhook-secret!!")}`;

vi.mock("cloudflare:workers", () => ({
  env: {
    CLERK_WEBHOOK_SECRET: SECRET,
    HYPERDRIVE: { connectionString: "postgres://user:pass@localhost:5432/clickfolio" },
  },
}));

const mockGetDb = vi.fn();

vi.mock("@/lib/db", () => ({ getDb: () => mockGetDb() }));

function signedRequest(body: string, signWith = SECRET): Request {
  const id = "msg_test";
  const now = new Date();

  return new Request("https://clickfolio.test/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
      "svix-signature": new Webhook(signWith).sign(id, now, body),
    },
    body,
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function deliver(request: Request): Promise<Response> {
  const { POST } = await import("@/app/api/webhooks/clerk/route");

  return POST(request);
}

describe("POST /api/webhooks/clerk", () => {
  it("answers 401 and logs a warning for a bad signature", async () => {
    const otherSecret = `whsec_${btoa("some-other-webhook-secret-value")}`;

    const response = await deliver(signedRequest('{"type":"user.created"}', otherSecret));

    expect(response.status).toBe(401);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized", code: "UNAUTHORIZED" });
    expect(logLines(warnSpy)).toContainEqual(
      expect.objectContaining({ msg: "[clerk-webhook] signature verification failed:" }),
    );
  });

  it.each([
    ["malformed JSON", "{type:"],
    ["an empty body", ""],
  ])("answers 400, not 401, for a correctly signed body with %s", async (_label, body) => {
    const response = await deliver(signedRequest(body));

    expect(response.status).toBe(400);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON payload",
      code: "BAD_REQUEST",
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("answers 400 for signed JSON without an event type", async () => {
    const response = await deliver(signedRequest(JSON.stringify({ data: {} })));

    expect(response.status).toBe(400);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
      code: "BAD_REQUEST",
    });
  });

  it("acknowledges a verified event it does not handle", async () => {
    const response = await deliver(signedRequest(JSON.stringify({ type: "session.created" })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      action: "ignored",
      detail: "session.created",
    });
    expect(mockGetDb).not.toHaveBeenCalled();
  });
});
