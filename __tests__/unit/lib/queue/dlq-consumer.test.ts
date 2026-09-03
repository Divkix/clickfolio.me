/**
 * DLQ Consumer Tests
 *
 * Tests for the Dead Letter Queue consumer that handles permanently
 * failed messages and sends alerts.
 */

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UnknownRecord } from "@/lib/types/json";
import { handleDLQMessage } from "@/lib/queue/dlq-consumer";
import { QueueErrorType } from "@/lib/queue/errors";
import type { DeadLetterMessage, QueueMessage } from "@/lib/queue/types";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/queue/notify-status", () => ({
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
}));

import { createMockDb, createMockDbResume } from "@/__tests__/setup/mocks/db.mock";
import { getDb } from "@/lib/db";
import { notifyStatusChange } from "@/lib/queue/notify-status";

describe("DLQ Consumer", () => {
  type MockEnv = { HYPERDRIVE: CloudflareEnv["HYPERDRIVE"]; CLICKFOLIO_STATUS_DO: undefined };
  const createMockEnv = (overrides: Record<string, string> = {}): MockEnv => ({
    HYPERDRIVE: {
      connectionString: "postgres://user:pass@localhost:5432/clickfolio",
    } as CloudflareEnv["HYPERDRIVE"],
    CLICKFOLIO_STATUS_DO: undefined,
    ...overrides,
  });
  const createMockDeadLetterMessage = (
    overrides: Partial<DeadLetterMessage> = {},
  ): DeadLetterMessage => ({
    originalMessage: {
      type: "parse",
      resumeId: "resume-123",
      userId: "user-456",
      r2Key: "uploads/resume.pdf",
      fileHash: "sha256-abc123",
      attempt: 3,
    },
    failureReason: "Max retries exceeded",
    failedAt: "2026-01-15T12:00:00.000Z",
    attempts: 3,
    ...overrides,
  });

  const createMockQueueMessage = (overrides: Partial<QueueMessage> = {}): QueueMessage => ({
    type: "parse",
    resumeId: "resume-123",
    userId: "user-456",
    r2Key: "uploads/resume.pdf",
    fileHash: "sha256-abc123",
    attempt: 3,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleDLQMessage - basic functionality", () => {
    it("should update resume status to failed for DeadLetterMessage", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        status: "processing",
        totalAttempts: 3,
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const message = createMockDeadLetterMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should update resume status to failed for raw QueueMessage", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        status: "processing",
        totalAttempts: 3,
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const message = createMockQueueMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should notify WebSocket clients of permanent failure", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        status: "processing",
        totalAttempts: 3,
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const message = createMockDeadLetterMessage({
        failureReason: "AI parsing permanently failed",
      });
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      expect(notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeId: "resume-123",
          status: "failed",
          error: expect.stringContaining("AI parsing permanently failed"),
        }),
      );
    });

    it("preserves an existing friendly errorMessage instead of overwriting it", async () => {
      const mockDb = createMockDb();
      const friendlyMessage =
        "Your PDF is password-protected. Please upload an unprotected version.";
      const mockResume = createMockDbResume({
        id: "resume-123",
        status: "processing",
        totalAttempts: 3,
        errorMessage: friendlyMessage,
        lastAttemptError: JSON.stringify({ type: QueueErrorType.INVALID_PDF }),
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      const updateSets: Array<UnknownRecord> = [];
      mockDb.update.mockReturnValue({
        set: vi.fn().mockImplementation((values: UnknownRecord) => {
          updateSets.push(values);
          return { where: vi.fn().mockResolvedValue(undefined) };
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const message = createMockDeadLetterMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      // The friendly message already on the row must survive — the DLQ must not
      // replace it with "Permanently failed after N attempts: ...".
      expect(updateSets[0]).toMatchObject({
        status: "failed",
        errorMessage: friendlyMessage,
      });
      expect(updateSets[0]?.errorMessage).not.toContain("Permanently failed");
      // The synthesized message is only built when errorMessage is null — the
      // WebSocket notification must also carry the friendly message.
      expect(notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          error: friendlyMessage,
        }),
      );
    });
  });

  describe("handleDLQMessage - alert channels", () => {
    it("should send logpush alert by default", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const message = createMockDeadLetterMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      // log() emits a single JSON string; find the DLQ_ALERT entry by msg field
      const dlqAlert = consoleSpy.mock.calls.find((call) => {
        try {
          return (JSON.parse(call[0]) as UnknownRecord)["msg"] === "DLQ_ALERT";
        } catch {
          return false;
        }
      });
      expect(dlqAlert).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("should send webhook alert when ALERT_CHANNEL is webhook", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("OK"));

      const message = createMockDeadLetterMessage();
      const env = createMockEnv({
        ALERT_CHANNEL: "webhook",
        ALERT_WEBHOOK_URL: "https://hooks.example.com/alerts",
      });

      await handleDLQMessage(message, env);

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://hooks.example.com/alerts",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      fetchSpy.mockRestore();
    });

    it("should handle webhook fetch failure gracefully", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const message = createMockDeadLetterMessage();
      const env = createMockEnv({
        ALERT_CHANNEL: "webhook",
        ALERT_WEBHOOK_URL: "https://hooks.example.com/alerts",
      });

      await handleDLQMessage(message, env);

      // log() emits a single JSON string; find the webhook alert failure entry by msg field
      const webhookFailLog = consoleSpy.mock.calls.find((call) => {
        try {
          return (JSON.parse(call[0]) as UnknownRecord)["msg"] === "webhook alert failed";
        } catch {
          return false;
        }
      });
      expect(webhookFailLog).toBeDefined();

      fetchSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("should fallback to logpush when webhook URL is not configured", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const fetchSpy = vi.spyOn(global, "fetch");

      const message = createMockDeadLetterMessage();
      const env = createMockEnv({
        ALERT_CHANNEL: "webhook",
        // ALERT_WEBHOOK_URL not set
      });

      await handleDLQMessage(message, env);

      // Should not attempt fetch without webhook URL
      expect(fetchSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it("should treat unsupported email alert channel as logpush", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const message = createMockDeadLetterMessage();
      const env = createMockEnv({
        ALERT_CHANNEL: "email",
      });

      await handleDLQMessage(message, env);

      // log() emits a single JSON string; unsupported channel falls back to logpush (DLQ_ALERT msg)
      const parsedCalls = consoleSpy.mock.calls.map((call) => {
        try {
          return JSON.parse(call[0]) as UnknownRecord;
        } catch {
          return null;
        }
      });
      const emailAlert = parsedCalls.find((p) => p?.["msg"] === "DLQ_ALERT_EMAIL");
      const logpushAlert = parsedCalls.find((p) => p?.["msg"] === "DLQ_ALERT");
      expect(emailAlert).toBeUndefined();
      expect(logpushAlert).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe("handleDLQMessage - error type extraction", () => {
    it("should extract error type from lastAttemptError", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
        lastAttemptError: JSON.stringify({
          type: QueueErrorType.AI_PROVIDER_ERROR,
          message: "AI service down",
        }),
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const message = createMockDeadLetterMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      // log() emits a single JSON string with all payload fields at the top level
      const dlqAlert = consoleSpy.mock.calls.find((call) => {
        try {
          return (JSON.parse(call[0]) as UnknownRecord)["msg"] === "DLQ_ALERT";
        } catch {
          return false;
        }
      });
      expect(dlqAlert).toBeDefined();
      const payload = JSON.parse(dlqAlert![0]) as UnknownRecord;
      expect(payload["errorType"]).toBe(QueueErrorType.AI_PROVIDER_ERROR);

      consoleSpy.mockRestore();
    });

    it("should handle missing lastAttemptError gracefully", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
        lastAttemptError: null,
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const message = createMockDeadLetterMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      // log() emits a single JSON string with all payload fields at the top level
      const dlqAlert = consoleSpy.mock.calls.find((call) => {
        try {
          return (JSON.parse(call[0]) as UnknownRecord)["msg"] === "DLQ_ALERT";
        } catch {
          return false;
        }
      });
      expect(dlqAlert).toBeDefined();
      const payload = JSON.parse(dlqAlert![0]) as UnknownRecord;
      expect(payload["errorType"]).toBe(QueueErrorType.UNKNOWN);

      consoleSpy.mockRestore();
    });

    it("should handle invalid JSON in lastAttemptError", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
        lastAttemptError: "not valid json",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const message = createMockDeadLetterMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      // Should not throw and should default to UNKNOWN; log() emits single JSON string
      const dlqAlert = consoleSpy.mock.calls.find((call) => {
        try {
          return (JSON.parse(call[0]) as UnknownRecord)["msg"] === "DLQ_ALERT";
        } catch {
          return false;
        }
      });
      expect(dlqAlert).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe("handleDLQMessage - edge cases", () => {
    it("should handle missing resume in database", async () => {
      const mockDb = createMockDb();

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const message = createMockDeadLetterMessage();
      const env = createMockEnv();

      await expect(handleDLQMessage(message, env)).resolves.not.toThrow();
    });

    it("should handle unknown failure reason for QueueMessage", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const message = createMockQueueMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      expect(notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Unknown (moved to DLQ)"),
        }),
      );
    });

    it("should handle high attempt counts", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 10,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const message = createMockDeadLetterMessage({ attempts: 10 });
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      expect(notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("10"),
        }),
      );
    });

    it("should log success message after processing", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const message = createMockDeadLetterMessage();
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      // log() emits a single JSON string; find the success entry by msg and resumeId fields
      const successLog = consoleSpy.mock.calls.find((call) => {
        try {
          const parsed = JSON.parse(call[0]) as UnknownRecord;
          return (
            parsed["msg"] === "DLQ: marked resume as permanently failed" &&
            parsed["resumeId"] === "resume-123"
          );
        } catch {
          return false;
        }
      });
      expect(successLog).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("should include all required fields in alert payload", async () => {
      const mockDb = createMockDb();
      const mockResume = createMockDbResume({
        id: "resume-123",
        totalAttempts: 3,
        status: "processing",
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockResume]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.mocked(getDb).mockReturnValue(mockDb as never);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const message = createMockDeadLetterMessage({
        failureReason: "Specific failure reason",
        attempts: 3,
      });
      const env = createMockEnv();

      await handleDLQMessage(message, env);

      // log() emits a single JSON string with all DLQAlertPayload fields at the top level
      const dlqAlert = consoleSpy.mock.calls.find((call) => {
        try {
          return (JSON.parse(call[0]) as UnknownRecord)["msg"] === "DLQ_ALERT";
        } catch {
          return false;
        }
      });
      expect(dlqAlert).toBeDefined();

      const payload = JSON.parse(dlqAlert![0]) as UnknownRecord;
      expect(payload).toHaveProperty("resumeId", "resume-123");
      expect(payload).toHaveProperty("userId", "user-456");
      expect(payload).toHaveProperty("failureReason", "Specific failure reason");
      expect(payload).toHaveProperty("errorType");
      expect(payload).toHaveProperty("totalAttempts", 3);
      expect(payload).toHaveProperty("timestamp");

      consoleSpy.mockRestore();
    });
  });
});
