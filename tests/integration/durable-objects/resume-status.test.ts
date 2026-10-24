import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ log: vi.fn() }));

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: Record<string, string>;
    env: Record<string, string>;

    constructor(ctx: Record<string, string>, env: Record<string, string>) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

type FakeSocket = {
  send: ReturnType<typeof vi.fn<(message: string) => void>>;
  close: ReturnType<typeof vi.fn<(code?: number, reason?: string) => void>>;
};

function fakeSocket(): FakeSocket {
  return {
    send: vi.fn<(message: string) => void>(),
    close: vi.fn<(code?: number, reason?: string) => void>(),
  };
}

function asSocket(socket: {
  send: (message: string) => void;
  close: (code?: number, reason?: string) => void;
}): WebSocket {
  // SAFETY: the object only calls send and close on a socket.
  return socket as WebSocket;
}

async function setup(initial: Record<string, string | number> = {}) {
  const { ClickfolioStatusDO } = await import("@/lib/durable-objects/resume-status");
  const store = new Map<string, string | number>(Object.entries(initial));
  const sockets: FakeSocket[] = [fakeSocket(), fakeSocket()];

  const storage = {
    get: vi.fn(async (keys: string | string[]) =>
      Array.isArray(keys)
        ? new Map(keys.flatMap((key) => (store.has(key) ? [[key, store.get(key)]] : [])))
        : store.get(keys),
    ),
    put: vi.fn(async (entries: Record<string, string | number>) => {
      for (const [key, value] of Object.entries(entries)) store.set(key, value);
    }),
    setAlarm: vi.fn(async () => {}),
    deleteAlarm: vi.fn(async () => {}),
    deleteAll: vi.fn(async () => {}),
  };

  const ctx = {
    storage,
    getWebSockets: () => sockets,
    acceptWebSocket: vi.fn(),
  };

  // Reflect.construct takes untyped arguments: the object only touches storage, getWebSockets
  // and acceptWebSocket on its state, all faked above, and never reads its env.
  const object: InstanceType<typeof ClickfolioStatusDO> = Reflect.construct(ClickfolioStatusDO, [
    ctx,
    {},
  ]);

  return { object, storage, sockets, store, ctx };
}

type Notice = Record<string, string | number>;

function rawNotify(text: string, headers: Record<string, string> = {}) {
  return new Request("https://do-internal/notify", { method: "POST", headers, body: text });
}

function notify(body: Notice, headers: Record<string, string> = {}) {
  return rawNotify(JSON.stringify(body), headers);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ClickfolioStatusDO notify", () => {
  it("stores the status, tells every open socket and arms the alarm for a final status", async () => {
    const { object, storage, sockets } = await setup();

    const response = await object.fetch(notify({ status: "failed", error: "boom", version: 10 }));

    expect(response.status).toBe(200);
    expect(storage.put).toHaveBeenCalledWith({
      lastStatus: "failed",
      lastError: "boom",
      lastVersion: 10,
    });

    for (const socket of sockets) {
      expect(JSON.parse(socket.send.mock.calls[0][0])).toMatchObject({
        type: "status",
        status: "failed",
        error: "boom",
      });
    }

    expect(storage.setAlarm).toHaveBeenCalledTimes(1);
  });

  it("clears the alarm for a status that is not final", async () => {
    const { object, storage } = await setup();

    await object.fetch(notify({ status: "processing" }));

    expect(storage.deleteAlarm).toHaveBeenCalledTimes(1);
    expect(storage.setAlarm).not.toHaveBeenCalled();
  });

  it("ignores a notice older than the stored watermark", async () => {
    const { object, storage, sockets } = await setup({ lastVersion: 20, lastStatus: "failed" });

    const response = await object.fetch(notify({ status: "processing", version: 20 }));

    expect(response.status).toBe(200);
    expect(storage.put).not.toHaveBeenCalled();
    expect(sockets[0].send).not.toHaveBeenCalled();
  });

  const rejectedBodies: { name: string; body: Notice; status: number }[] = [
    { name: "a missing status", body: {}, status: 400 },
    { name: "an unknown status", body: { status: "bogus" }, status: 400 },
    { name: "a non-string error", body: { status: "failed", error: 5 }, status: 400 },
    {
      name: "an over-long error",
      body: { status: "failed", error: "x".repeat(2_001) },
      status: 400,
    },
    { name: "a non-numeric version", body: { status: "failed", version: "1" }, status: 400 },
    {
      name: "an oversized body",
      body: { status: "failed", error: "x".repeat(9_000) },
      status: 413,
    },
  ];

  it.each(rejectedBodies)(
    "answers $status to $name without storing or broadcasting",
    async ({ body, status }) => {
      const { object, storage, sockets } = await setup();

      const response = await object.fetch(notify(body));

      expect(response.status).toBe(status);
      expect(storage.put).not.toHaveBeenCalled();
      expect(sockets[0].send).not.toHaveBeenCalled();
    },
  );

  it("answers 400 to malformed JSON without storing or broadcasting", async () => {
    const { object, storage, sockets } = await setup();

    const response = await object.fetch(rawNotify("{nope"));

    expect(response.status).toBe(400);
    expect(storage.put).not.toHaveBeenCalled();
    expect(sockets[0].send).not.toHaveBeenCalled();
  });

  it("rejects a declared oversized body before reading it", async () => {
    const { object, storage } = await setup();

    const response = await object.fetch(
      notify({ status: "failed" }, { "Content-Length": "100000" }),
    );

    expect(response.status).toBe(413);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("answers 500 and logs when storage fails", async () => {
    const { object, storage } = await setup();
    storage.put.mockRejectedValue(new Error("storage unavailable"));

    const response = await object.fetch(notify({ status: "processing" }));

    expect(response.status).toBe(500);
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "ClickfolioStatusDO notify failed",
      expect.objectContaining({ "error.message": "storage unavailable" }),
    );
  });

  it("keeps going and logs when one socket cannot be written", async () => {
    const { object, sockets } = await setup();
    sockets[0].send.mockImplementation(() => {
      throw new Error("socket closed");
    });

    const response = await object.fetch(notify({ status: "completed" }));

    expect(response.status).toBe(200);
    expect(sockets[1].send).toHaveBeenCalledTimes(1);
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "ClickfolioStatusDO WebSocket send failed",
      expect.objectContaining({ "error.message": "socket closed" }),
    );
  });
});

describe("ClickfolioStatusDO routing and upgrade", () => {
  it("answers 404 to anything else", async () => {
    const { object } = await setup();

    const response = await object.fetch(new Request("https://do-internal/other"));

    expect(response.status).toBe(404);
  });

  const unusableUserIds: Record<string, string>[] = [
    {},
    { "X-Authenticated-User-Id": "" },
    { "X-Authenticated-User-Id": "u".repeat(300) },
  ];

  it.each(unusableUserIds)(
    "refuses a websocket upgrade without a usable user id: %j",
    async (headers) => {
      const { object, ctx } = await setup();

      const response = await object.fetch(
        new Request("https://do-internal/ws", { headers: { Upgrade: "websocket", ...headers } }),
      );

      expect(response.status).toBe(401);
      expect(ctx.acceptWebSocket).not.toHaveBeenCalled();
    },
  );

  it("answers 500 and logs when the stored status cannot be read, before accepting a socket", async () => {
    const { object, storage, ctx } = await setup();
    storage.get.mockRejectedValue(new Error("storage unavailable"));

    const response = await object.fetch(
      new Request("https://do-internal/ws", {
        headers: { Upgrade: "websocket", "X-Authenticated-User-Id": "user_1" },
      }),
    );

    expect(response.status).toBe(500);
    expect(ctx.acceptWebSocket).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "ClickfolioStatusDO WebSocket upgrade failed",
      expect.objectContaining({ "error.message": "storage unavailable" }),
    );
  });
});

describe("ClickfolioStatusDO websocket handlers", () => {
  it("answers ping with pong", async () => {
    const { object } = await setup();
    const ws = fakeSocket();

    await object.webSocketMessage(asSocket(ws), "ping");

    expect(ws.send).toHaveBeenCalledWith("pong");
  });

  it("answers status with the stored status", async () => {
    const { object } = await setup({ lastStatus: "completed", lastError: "" });
    const ws = fakeSocket();

    await object.webSocketMessage(asSocket(ws), "status");

    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
      type: "status",
      status: "completed",
    });
  });

  it("logs a stored status that no longer validates and sends nothing", async () => {
    const { object } = await setup({ lastStatus: "corrupt" });
    const ws = fakeSocket();

    await object.webSocketMessage(asSocket(ws), "status");

    expect(ws.send).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "ClickfolioStatusDO stored status is unreadable",
      expect.anything(),
    );
  });

  it("ignores unknown text but closes on binary and oversized frames", async () => {
    const { object } = await setup();
    const ws = fakeSocket();

    const socket = asSocket(ws);

    await object.webSocketMessage(socket, "hello");
    expect(ws.send).not.toHaveBeenCalled();
    expect(ws.close).not.toHaveBeenCalled();

    await object.webSocketMessage(socket, new ArrayBuffer(4));
    expect(ws.close).toHaveBeenLastCalledWith(1003, expect.any(String));

    await object.webSocketMessage(socket, "x".repeat(2_000));
    expect(ws.close).toHaveBeenLastCalledWith(1009, expect.any(String));
  });

  it("logs a failing message handler and closes the socket", async () => {
    const { object, storage } = await setup();
    storage.get.mockRejectedValue(new Error("storage unavailable"));
    const ws = fakeSocket();

    await object.webSocketMessage(asSocket(ws), "status");

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "ClickfolioStatusDO WebSocket message failed",
      expect.objectContaining({ "error.message": "storage unavailable" }),
    );
    expect(ws.close).toHaveBeenCalledWith(1011, expect.any(String));
  });

  it("logs a socket error and a close that itself throws", async () => {
    const { object } = await setup();
    const ws = fakeSocket();
    ws.close.mockImplementation(() => {
      throw new Error("already closed");
    });

    await object.webSocketError(asSocket(ws), new Error("transport reset"));

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "ClickfolioStatusDO WebSocket error",
      expect.objectContaining({ "error.message": "transport reset" }),
    );
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "ClickfolioStatusDO WebSocket close failed",
      expect.objectContaining({ "error.message": "already closed" }),
    );
  });
});

describe("ClickfolioStatusDO alarm", () => {
  it("closes the sockets and clears storage", async () => {
    const { object, storage, sockets } = await setup();

    await object.alarm();

    for (const socket of sockets)
      expect(socket.close).toHaveBeenCalledWith(1000, expect.any(String));
    expect(storage.deleteAll).toHaveBeenCalledTimes(1);
  });

  it("logs and rethrows a failed cleanup so the runtime retries the alarm", async () => {
    const { object, storage } = await setup();
    storage.deleteAll.mockRejectedValue(new Error("storage unavailable"));

    await expect(object.alarm()).rejects.toThrow("storage unavailable");
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "ClickfolioStatusDO alarm cleanup failed",
      expect.objectContaining({ "error.message": "storage unavailable" }),
    );
  });
});
