import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import { statusNoticeSchema, type StatusNotice } from "@/lib/effect/services/status-channel";
import { isValidResumeStatus } from "@/lib/realtime/constants";
import type { JsonValue } from "@/lib/types/json";
import { annotateActiveSpan } from "@/lib/telemetry/spans";

interface StatusMessage {
  type: "status";
  status: ResumeStatus;
  error?: string;
  timestamp: string;
}

// A notice is a few hundred bytes; anything near this is not from our Worker.
const MAX_NOTIFY_BODY_CHARS = 8_192;

// The client sends "ping" every 30s and nothing else; "status" is the only other command.
const MAX_SOCKET_MESSAGE_CHARS = 1_024;

const socketCommandSchema = z.enum(["ping", "status"]);

// Set by the Worker from the verified Clerk session; this only bounds what a stray caller sends.
const userIdSchema = z.string().min(1).max(256);

const storedStatusSchema = z.object({
  lastStatus: z.string().refine(isValidResumeStatus),
  lastError: z.string().optional(),
});

const storedVersionSchema = z.number().finite();

// WebSocket close codes (RFC 6455 section 7.4.1).
const CLOSE_UNSUPPORTED_DATA = 1003;

const CLOSE_MESSAGE_TOO_BIG = 1009;

const CLOSE_INTERNAL_ERROR = 1011;

export class ClickfolioStatusDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/notify") {
      annotateActiveSpan({ "status_do.operation": "notify" });

      return this.handleNotify(request);
    }

    const upgradeHeader = request.headers.get("Upgrade");

    if (upgradeHeader?.toLowerCase() === "websocket") {
      annotateActiveSpan({ "status_do.operation": "websocket_upgrade" });

      return this.handleWebSocketUpgrade(request);
    }

    return new Response("Not found", { status: 404 });
  }

  /** The last pushed status, or null when none is stored or the stored value is unreadable. */
  private async cachedStatusMessage(): Promise<StatusMessage | null> {
    const cached = await this.ctx.storage.get<string>(["lastStatus", "lastError"]);
    const stored = storedStatusSchema.safeParse(Object.fromEntries(cached));

    if (!stored.success) {
      // Nothing stored yet is normal; a stored value that fails validation is not.
      if (cached.has("lastStatus")) {
        log("warn", "ClickfolioStatusDO stored status is unreadable", {
          issues: stored.error.issues.map((issue) => issue.code),
        });
      }

      return null;
    }

    const msg: StatusMessage = {
      type: "status",
      status: stored.data.lastStatus,
      timestamp: new Date().toISOString(),
    };

    if (stored.data.lastError) {
      msg.error = stored.data.lastError;
    }

    return msg;
  }

  private closeSocket(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch (error) {
      // Closing a socket the peer already closed throws; it is the end state we wanted.
      log("warn", "ClickfolioStatusDO WebSocket close failed", {
        code,
        ...errorFields(error),
      });
    }
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const userId = userIdSchema.safeParse(request.headers.get("X-Authenticated-User-Id"));

    if (!userId.success) {
      return new Response("Unauthorized: Missing authentication", { status: 401 });
    }

    let server: WebSocket | undefined;

    try {
      // Read before accepting, so a storage failure leaves no half-open socket behind.
      const cachedMessage = await this.cachedStatusMessage();

      const pair = new WebSocketPair();
      const [client, accepted] = Object.values(pair);
      server = accepted;

      this.ctx.acceptWebSocket(server);

      if (cachedMessage) {
        server.send(JSON.stringify(cachedMessage));
      }

      return new Response(null, { status: 101, webSocket: client });
    } catch (error) {
      log("error", "ClickfolioStatusDO WebSocket upgrade failed", errorFields(error));

      if (server) this.closeSocket(server, CLOSE_INTERNAL_ERROR, "Upgrade failed");

      return new Response("Internal error", { status: 500 });
    }
  }

  private async readNotice(
    request: Request,
  ): Promise<{ notice: StatusNotice } | { rejected: Response }> {
    const declared = Number(request.headers.get("Content-Length"));

    if (declared > MAX_NOTIFY_BODY_CHARS) {
      return { rejected: new Response("Payload too large", { status: 413 }) };
    }

    const text = await request.text();

    if (text.length > MAX_NOTIFY_BODY_CHARS) {
      return { rejected: new Response("Payload too large", { status: 413 }) };
    }

    let json: JsonValue;

    try {
      json = JSON.parse(text);
    } catch {
      return { rejected: new Response("Invalid JSON", { status: 400 }) };
    }

    const parsed = statusNoticeSchema.safeParse(json);

    if (!parsed.success) {
      return { rejected: new Response("Invalid notify body", { status: 400 }) };
    }

    return { notice: parsed.data };
  }

  private async handleNotify(request: Request): Promise<Response> {
    try {
      const read = await this.readNotice(request);

      if ("rejected" in read) return read.rejected;

      const { status, error, version } = read.notice;

      const storedVersion = storedVersionSchema.safeParse(
        await this.ctx.storage.get<number>("lastVersion"),
      );

      const stale = version !== undefined && storedVersion.success && version <= storedVersion.data;
      annotateActiveSpan({ "resume.status": status, "status_do.stale": stale });

      if (stale) {
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
      annotateActiveSpan({ "status_do.sockets": sockets.length });

      for (const ws of sockets) {
        try {
          ws.send(payload);
        } catch (sendError) {
          // A socket closing mid-broadcast throws; the client re-reads status on reconnect.
          log("warn", "ClickfolioStatusDO WebSocket send failed", errorFields(sendError));
        }
      }

      if (status === "completed" || status === "failed") {
        await this.ctx.storage.setAlarm(Date.now() + 30_000);
      } else {
        await this.ctx.storage.deleteAlarm();
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      // The sender logs the 500 too; this line says why.
      log("error", "ClickfolioStatusDO notify failed", errorFields(error));

      return new Response("Internal error", { status: 500 });
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      if (message instanceof ArrayBuffer) {
        this.closeSocket(ws, CLOSE_UNSUPPORTED_DATA, "Text messages only");

        return;
      }

      if (message.length > MAX_SOCKET_MESSAGE_CHARS) {
        this.closeSocket(ws, CLOSE_MESSAGE_TOO_BIG, "Message too big");

        return;
      }

      const command = socketCommandSchema.safeParse(message);

      // Not a command we know: nothing to answer, and the client never sends one.
      if (!command.success) return;

      if (command.data === "ping") {
        ws.send("pong");

        return;
      }

      const cachedMessage = await this.cachedStatusMessage();

      if (cachedMessage) {
        ws.send(JSON.stringify(cachedMessage));
      }
    } catch (error) {
      log("error", "ClickfolioStatusDO WebSocket message failed", errorFields(error));
      this.closeSocket(ws, CLOSE_INTERNAL_ERROR, "Internal error");
    }
  }

  // The runtime completes the close handshake and stops tracking the socket, and this object
  // keeps no per-socket state, so there is nothing to release and nothing that can fail here.
  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {}

  async webSocketError(ws: WebSocket, error: JsonValue | Error): Promise<void> {
    log("error", "ClickfolioStatusDO WebSocket error", errorFields(error));
    this.closeSocket(ws, CLOSE_INTERNAL_ERROR, "WebSocket error");
  }

  async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    annotateActiveSpan({ "status_do.sockets": sockets.length });

    for (const ws of sockets) {
      this.closeSocket(ws, 1000, "Resume processing complete");
    }

    try {
      await this.ctx.storage.deleteAll();
    } catch (error) {
      log("error", "ClickfolioStatusDO alarm cleanup failed", errorFields(error));

      // The runtime retries a failed alarm, so the stored status is cleaned up later.
      throw error;
    }
  }
}
