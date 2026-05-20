import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  nextClient: null as FakeSocket | null,
  nextServer: null as FakeSocket | null,
}));

class FakeSocket {
  sent: string[] = [];
  closed: Array<{ code: number; reason: string }> = [];

  send(payload: string) {
    this.sent.push(payload);
  }

  close(code: number, reason: string) {
    this.closed.push({ code, reason });
  }
}

class ThrowingSocket extends FakeSocket {
  override send() {
    throw new Error("closed");
  }

  override close() {
    throw new Error("already closed");
  }
}

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;

    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

function installWebSocketPair(client = new FakeSocket(), server = new FakeSocket()) {
  runtime.nextClient = client;
  runtime.nextServer = server;
  vi.stubGlobal(
    "WebSocketPair",
    class {
      0 = runtime.nextClient;
      1 = runtime.nextServer;
    },
  );
  return { client, server };
}

function createObject() {
  const values = new Map<string, string>();
  const sockets: FakeSocket[] = [];
  const ctx = {
    storage: {
      get: vi.fn(async (keys: string[]) => {
        const result = new Map<string, string>();
        for (const key of keys) {
          if (values.has(key)) {
            result.set(key, values.get(key) ?? "");
          }
        }
        return result;
      }),
      put: vi.fn(async (items: Record<string, string>) => {
        for (const [key, value] of Object.entries(items)) {
          values.set(key, value);
        }
      }),
      setAlarm: vi.fn(async () => undefined),
      deleteAll: vi.fn(async () => values.clear()),
    },
    acceptWebSocket: vi.fn((socket: FakeSocket) => {
      sockets.push(socket);
    }),
    getWebSockets: vi.fn(() => sockets),
    sockets,
    values,
  };

  return import("@/lib/durable-objects/resume-status").then(({ ClickfolioStatusDO }) => ({
    instance: new ClickfolioStatusDO(ctx as never, {} as never) as InstanceType<
      typeof ClickfolioStatusDO
    >,
    ctx,
  }));
}

describe("ClickfolioStatusDO", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-upgrade requests, unauthenticated sockets, and malformed notify bodies", async () => {
    const { instance } = await createObject();

    await expect(instance.fetch(new Request("https://do.example/"))).resolves.toMatchObject({
      status: 404,
    });
    await expect(
      instance.fetch(new Request("https://do.example/", { headers: { Upgrade: "websocket" } })),
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      instance.fetch(new Request("https://do.example/notify", { method: "POST", body: "{" })),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      instance.fetch(
        new Request("https://do.example/notify", {
          method: "POST",
          body: JSON.stringify({ error: "missing" }),
        }),
      ),
    ).resolves.toMatchObject({ status: 400 });
  });

  it("accepts authenticated websocket upgrades and sends cached status immediately", async () => {
    const { client, server } = installWebSocketPair();
    const { ctx, instance } = await createObject();
    ctx.values.set("lastStatus", "failed");
    ctx.values.set("lastError", "Parse failed");

    await expect(
      instance.fetch(
        new Request("https://do.example/", {
          headers: {
            Upgrade: "websocket",
            "X-Authenticated-User-Id": "user_1",
          },
        }),
      ),
    ).rejects.toThrow(/status/);

    expect(ctx.acceptWebSocket).toHaveBeenCalledWith(server);
    expect(JSON.parse(server.sent[0])).toMatchObject({
      type: "status",
      status: "failed",
      error: "Parse failed",
    });
    expect(client).toBeInstanceOf(FakeSocket);
  });

  it("stores status updates, broadcasts them, and schedules terminal cleanup", async () => {
    const { server } = installWebSocketPair();
    const { ctx, instance } = await createObject();
    await expect(
      instance.fetch(
        new Request("https://do.example/", {
          headers: {
            Upgrade: "websocket",
            "X-Authenticated-User-Id": "user_1",
          },
        }),
      ),
    ).rejects.toThrow(/status/);
    ctx.sockets.push(new ThrowingSocket());

    const response = await instance.fetch(
      new Request("https://do.example/notify", {
        method: "POST",
        body: JSON.stringify({ status: "completed", error: "ignored by clients" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(ctx.values.get("lastStatus")).toBe("completed");
    expect(ctx.values.get("lastError")).toBe("ignored by clients");
    expect(JSON.parse(server.sent.at(-1) ?? "{}")).toMatchObject({
      type: "status",
      status: "completed",
      error: "ignored by clients",
    });
    expect(ctx.storage.setAlarm).toHaveBeenCalledWith(expect.any(Number));
  });

  it("responds to websocket pings, status requests, errors, and cleanup alarms", async () => {
    const { ctx, instance } = await createObject();
    const socket = new FakeSocket();
    const closedSocket = new ThrowingSocket();
    ctx.sockets.push(socket, closedSocket);
    ctx.values.set("lastStatus", "processing");
    ctx.values.set("lastError", "");

    await instance.webSocketMessage(socket as never, new ArrayBuffer(1));
    await instance.webSocketMessage(socket as never, "ping");
    await instance.webSocketMessage(socket as never, "status");
    await instance.webSocketClose(socket as never, 1000, "done", true);
    await instance.webSocketError(socket as never, new Error("boom"));
    await instance.alarm();

    expect(socket.sent[0]).toBe("pong");
    expect(JSON.parse(socket.sent[1])).toMatchObject({
      type: "status",
      status: "processing",
    });
    expect(socket.closed).toContainEqual({ code: 1011, reason: "WebSocket error" });
    expect(socket.closed).toContainEqual({ code: 1000, reason: "Resume processing complete" });
    expect(ctx.storage.deleteAll).toHaveBeenCalled();
  });
});
