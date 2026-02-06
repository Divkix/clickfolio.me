import { DurableObject } from "cloudflare:workers";

/**
 * Status message sent to connected WebSocket clients.
 */
interface StatusMessage {
  type: "status";
  status: string;
  error?: string;
  timestamp: string;
}

/**
 * Durable Object for resume status notifications via WebSocket Hibernation.
 *
 * Keyed by resumeId. Accepts WebSocket connections from clients waiting for
 * status updates, and receives POST /notify from the queue consumer when
 * status changes. Broadcasts to all connected clients instantly.
 *
 * Uses the Hibernatable WebSocket API so the DO is evicted from memory
 * when idle (zero cost during hibernation).
 */
export class ResumeStatusDO extends DurableObject {
  /**
   * Handle incoming requests:
   * - WebSocket upgrade: accept connection, send cached status if available
   * - POST /notify: store status, broadcast to all connected WebSockets
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /notify — called by queue consumer when status changes
    if (request.method === "POST" && url.pathname === "/notify") {
      return this.handleNotify(request);
    }

    // WebSocket upgrade — client connecting for live updates
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() === "websocket") {
      return this.handleWebSocketUpgrade();
    }

    return new Response("Not found", { status: 404 });
  }

  /**
   * Accept a WebSocket connection via the Hibernation API.
   * If there's a cached status, send it immediately so the client
   * doesn't need a separate HTTP fetch.
   */
  private async handleWebSocketUpgrade(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept via hibernation API (DO can be evicted while WS stays open)
    this.ctx.acceptWebSocket(server);

    // Send cached status immediately if available (batched read)
    const cached = await this.ctx.storage.get<string>(["lastStatus", "lastError"]);
    const cachedStatus = cached.get("lastStatus");
    const cachedError = cached.get("lastError");

    if (cachedStatus) {
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

  /**
   * Handle POST /notify from queue consumer.
   * Stores status in transactional storage and broadcasts to all connected clients.
   */
  private async handleNotify(request: Request): Promise<Response> {
    let body: { status: string; error?: string };
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { status, error } = body;
    if (!status) {
      return new Response("Missing status", { status: 400 });
    }

    // Store in DO storage (survives hibernation) — atomic batched write
    await this.ctx.storage.put({
      lastStatus: status,
      lastError: error ?? "",
    });

    // Broadcast to all connected WebSockets
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
      } catch {
        // Socket already closed, ignore
      }
    }

    // If terminal state, schedule cleanup alarm in 30 seconds
    if (status === "completed" || status === "failed") {
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
    }

    return new Response("OK", { status: 200 });
  }

  /**
   * Handle incoming WebSocket messages (ping/status requests).
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    if (message === "ping") {
      ws.send("pong");
      return;
    }

    // Handle explicit status request (batched read)
    if (message === "status") {
      const cached = await this.ctx.storage.get<string>(["lastStatus", "lastError"]);
      const cachedStatus = cached.get("lastStatus");
      const cachedError = cached.get("lastError");

      if (cachedStatus) {
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

  /**
   * Handle WebSocket close — cleanup.
   */
  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // No special cleanup needed. If all sockets close,
    // the DO will naturally hibernate and the alarm will clean up storage.
  }

  /**
   * Handle WebSocket error — log and close.
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("ResumeStatusDO WebSocket error:", error);
    try {
      ws.close(1011, "WebSocket error");
    } catch {
      // Already closed
    }
  }

  /**
   * Alarm fires 30s after terminal state.
   * Closes any remaining sockets and deletes all storage.
   */
  async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.close(1000, "Resume processing complete");
      } catch {
        // Already closed
      }
    }

    // Clean up all storage
    await this.ctx.storage.deleteAll();
  }
}
