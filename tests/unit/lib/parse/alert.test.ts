import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UnknownRecord } from "@/lib/types/json";
import { sendAlert, getAlertChannel } from "@/lib/parse/alert";

type MockEnv = {
  HYPERDRIVE: CloudflareEnv["HYPERDRIVE"];
  CLICKFOLIO_STATUS_DO: undefined;
  ALERT_WEBHOOK_URL?: string;
  ALERT_CHANNEL?: string;
};

function createMockEnv(overrides: Record<string, string | undefined> = {}): MockEnv {
  return {
    HYPERDRIVE: {
      connectionString: "postgres://user:pass@localhost:5432/clickfolio",
      host: "localhost",
      ip: "127.0.0.1",
      port: 5432,
      user: "user",
      password: "pass",
      database: "clickfolio",
      connect: vi.fn(),
    },
    CLICKFOLIO_STATUS_DO: undefined,
    ...overrides,
  };
}

const defaultPayload = {
  resumeId: "resume-123",
  userId: "user-456",
  failureReason: "Max retries exceeded",
  errorType: "invalid_pdf",
  totalAttempts: 3,
  timestamp: "2026-01-15T12:00:00.000Z",
};

describe("alert module", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAlertChannel", () => {
    it('returns "logpush" for undefined or missing channel', () => {
      expect(getAlertChannel(undefined)).toBe("logpush");
      expect(getAlertChannel("")).toBe("logpush");
    });

    it('returns "logpush" for unknown channel values', () => {
      expect(getAlertChannel("email")).toBe("logpush");
      expect(getAlertChannel("pagerduty")).toBe("logpush");
    });

    it('returns "webhook" when ALERT_CHANNEL is "webhook"', () => {
      expect(getAlertChannel("webhook")).toBe("webhook");
    });
  });

  describe("sendAlert — logpush", () => {
    it("logs a PARSE_FAILURE_ALERT entry via log() for logpush channel", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const env = createMockEnv();
      await sendAlert(defaultPayload, "logpush", env);

      const failureAlert = consoleSpy.mock.calls.find((call) => {
        try {
          const parsed: UnknownRecord = JSON.parse(call[0]);

          return parsed["msg"] === "PARSE_FAILURE_ALERT";
        } catch {
          return false;
        }
      });

      expect(failureAlert).toBeDefined();

      const payload: UnknownRecord = JSON.parse(failureAlert![0]);
      expect(payload).toMatchObject({
        resumeId: "resume-123",
        userId: "user-456",
        failureReason: "Max retries exceeded",
        errorType: "invalid_pdf",
        totalAttempts: 3,
      });

      consoleSpy.mockRestore();
    });
  });

  describe("sendAlert — webhook", () => {
    it("POSTs to the webhook URL when configured", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("OK"));

      const env = createMockEnv({
        ALERT_CHANNEL: "webhook",
        ALERT_WEBHOOK_URL: "https://hooks.example.com/alerts",
      });

      await sendAlert(defaultPayload, "webhook", env);

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://hooks.example.com/alerts",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      fetchSpy.mockRestore();
    });

    it("does nothing when webhook URL is not configured", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");

      const env = createMockEnv({ ALERT_CHANNEL: "webhook" });
      await sendAlert(defaultPayload, "webhook", env);

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("handles webhook fetch failure gracefully", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const env = createMockEnv({
        ALERT_CHANNEL: "webhook",
        ALERT_WEBHOOK_URL: "https://hooks.example.com/alerts",
      });

      await sendAlert(defaultPayload, "webhook", env);

      const webhookFailLog = consoleSpy.mock.calls.find((call) => {
        try {
          const parsed: UnknownRecord = JSON.parse(call[0]);

          return parsed["msg"] === "webhook alert failed";
        } catch {
          return false;
        }
      });

      expect(webhookFailLog).toBeDefined();

      fetchSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});
