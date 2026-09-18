import { DurableObject } from "cloudflare:workers";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { isValidResumeStatus } from "@/lib/realtime/constants";
import type { JsonValue } from "@/lib/types/json";

interface StatusMessage {
  type: "status";
  status: ResumeStatus;
  error?: string;
  timestamp: string;
}

export class ClickfolioStatusDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/notify") {
      return this.handleNotify(request);
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const userId = request.headers.get("X-Authenticated-User-Id");
    if (!userId) {
      return new Response("Unauthorized: Missing authentication", { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    const cached = await this.ctx.storage.get<string>(["lastStatus", "lastError"]);
    const cachedStatus = cached.get("lastStatus");
    const cachedError = cached.get("lastError");

    if (cachedStatus && isValidResumeStatus(cachedStatus)) {
      const msg: StatusMessage = {
        type: "status",
        status: cachedStatus,
        timestamp: new Date().toISOString(),
      };
      if (cachedError) {
        msg.error = cachedError;
      }
      server.send(JSON.stringify(msg));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleNotify(request: Request): Promise<Response> {
    let body: { status: ResumeStatus; error?: string; version?: number };
    try {
      // SAFETY: request JSON shape is validated immediately after via isValidResumeStatus; cast provides typed destructuring with 400 on invalid status
      body = (await request.json()) as { status: ResumeStatus; error?: string; version?: number };
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { status, error } = body;
    // SAFETY: version arrives only from our own notify sender as Date.now() ms; Number.isFinite narrows unknown to number here.
    const version = Number.isFinite(body.version) ? (body.version as number) : undefined;
    if (!status) {
      return new Response("Missing status", { status: 400 });
    }
    if (!isValidResumeStatus(status)) {
      return new Response("Invalid status", { status: 400 });
    }

    const storedVersion = await this.ctx.storage.get<number>("lastVersion");
    // SAFETY: stored watermark is written only above as a finite number; Number.isFinite re-narrows unknown storage output.
    const storedRank = Number.isFinite(storedVersion) ? (storedVersion as number) : undefined;
    if (version !== undefined && storedRank !== undefined && version <= storedRank) {
      // Out-of-order notify: a newer status is already stored (and its alarm
      // state already set), so the late one must not overwrite or cancel it.
      return new Response("OK", { status: 200 });
    }

    // A version-less (legacy) notify is accepted but must not lower the
    // ordering watermark for the versioned notifies that follow it.
    if (version === undefined) {
      await this.ctx.storage.put({ lastStatus: status, lastError: error ?? "" });
    } else {
      await this.ctx.storage.put({
        lastStatus: status,
        lastError: error ?? "",
        lastVersion: version,
      });
    }

    const msg: StatusMessage = {
      type: "status",
      status,
      timestamp: new Date().toISOString(),
    };
    if (error) {
      msg.error = error;
    }

    const payload = JSON.stringify(msg);
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send(payload);
      } catch {}
    }

    if (status === "completed" || status === "failed") {
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
    } else {
      await this.ctx.storage.deleteAlarm();
    }

    return new Response("OK", { status: 200 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message instanceof ArrayBuffer) return;

    if (message === "ping") {
      ws.send("pong");
      return;
    }

    if (message === "status") {
      const cached = await this.ctx.storage.get<string>(["lastStatus", "lastError"]);
      const cachedStatus = cached.get("lastStatus");
      const cachedError = cached.get("lastError");

      if (cachedStatus && isValidResumeStatus(cachedStatus)) {
        const msg: StatusMessage = {
          type: "status",
          status: cachedStatus,
          timestamp: new Date().toISOString(),
        };
        if (cachedError) {
          msg.error = cachedError;
        }
        ws.send(JSON.stringify(msg));
      }
    }
  }

  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {}

  async webSocketError(ws: WebSocket, error: JsonValue | Error): Promise<void> {
    console.error("ClickfolioStatusDO WebSocket error:", error);
    try {
      ws.close(1011, "WebSocket error");
    } catch {}
  }

  async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.close(1000, "Resume processing complete");
      } catch {}
    }

    await this.ctx.storage.deleteAll();
  }
}
