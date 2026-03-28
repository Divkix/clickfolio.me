/**
 * Queue Types Tests
 *
 * Tests for Zod schemas and type definitions for queue messages.
 */

import { describe, expect, it } from "vitest";
import {
  type DeadLetterMessage,
  type QueueMessage,
  queueMessageSchema,
  type ResumeParseMessage,
} from "@/lib/queue/types";

describe("Queue Types", () => {
  describe("queueMessageSchema - valid messages", () => {
    it("should accept a valid parse message", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should accept message with multiple attempts", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 3,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should accept UUID-formatted IDs", () => {
      const message = {
        type: "parse",
        resumeId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        r2Key: "uploads/uuid-resume.pdf",
        fileHash: `sha256-${"a".repeat(64)}`,
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should accept long fileHash values", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: `sha256-${"x".repeat(1000)}`,
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it("should accept nested R2 keys", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/2026/01/15/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe("queueMessageSchema - invalid messages", () => {
    it("should reject missing type", () => {
      const message = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject wrong type literal", () => {
      const message = {
        type: "wrong",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject missing resumeId", () => {
      const message = {
        type: "parse",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject empty resumeId", () => {
      const message = {
        type: "parse",
        resumeId: "",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject missing userId", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject empty userId", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject missing r2Key", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject empty r2Key", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject missing fileHash", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject empty fileHash", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject missing attempt", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject zero attempt", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 0,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject negative attempt", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: -1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject non-integer attempt", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1.5,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject non-numeric attempt", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: "one",
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject wrong type for resumeId", () => {
      const message = {
        type: "parse",
        resumeId: 123,
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject wrong type for userId", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: 456,
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject null values", () => {
      const message = {
        type: "parse",
        resumeId: null,
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject undefined values", () => {
      const message = {
        type: "parse",
        resumeId: undefined,
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });

    it("should reject empty object", () => {
      const result = queueMessageSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject null", () => {
      const result = queueMessageSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it("should reject undefined", () => {
      const result = queueMessageSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it("should reject array", () => {
      const result = queueMessageSchema.safeParse([]);
      expect(result.success).toBe(false);
    });

    it("should reject string", () => {
      const result = queueMessageSchema.safeParse("parse");
      expect(result.success).toBe(false);
    });
  });

  describe("queueMessageSchema - parsing success", () => {
    it("should return correct parsed data on success", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 2,
      };

      const result = queueMessageSchema.parse(message);
      expect(result).toEqual(message);
    });

    it("should coerce to correct types", () => {
      const message = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      const result = queueMessageSchema.parse(message);
      expect(typeof result.attempt).toBe("number");
    });
  });

  describe("ResumeParseMessage type", () => {
    it("should satisfy type constraints", () => {
      const message: ResumeParseMessage = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      expect(message.type).toBe("parse");
      expect(message.attempt).toBe(1);
    });
  });

  describe("QueueMessage union type", () => {
    it("should accept ResumeParseMessage", () => {
      const message: QueueMessage = {
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 1,
      };

      expect(message.type).toBe("parse");
    });
  });

  describe("DeadLetterMessage interface", () => {
    it("should accept valid dead letter structure", () => {
      const dlqMessage: DeadLetterMessage = {
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
      };

      expect(dlqMessage.originalMessage.resumeId).toBe("resume-123");
      expect(dlqMessage.failureReason).toBe("Max retries exceeded");
      expect(dlqMessage.attempts).toBe(3);
    });

    it("should accept error as failure reason", () => {
      const dlqMessage: DeadLetterMessage = {
        originalMessage: {
          type: "parse",
          resumeId: "resume-123",
          userId: "user-456",
          r2Key: "uploads/resume.pdf",
          fileHash: "sha256-abc123",
          attempt: 3,
        },
        failureReason: "AI provider timeout after 3 attempts",
        failedAt: new Date().toISOString(),
        attempts: 3,
      };

      expect(dlqMessage.attempts).toBe(3);
    });

    it("should accept high attempt counts", () => {
      const dlqMessage: DeadLetterMessage = {
        originalMessage: {
          type: "parse",
          resumeId: "resume-123",
          userId: "user-456",
          r2Key: "uploads/resume.pdf",
          fileHash: "sha256-abc123",
          attempt: 10,
        },
        failureReason: "Permanent failure",
        failedAt: "2026-01-15T12:00:00.000Z",
        attempts: 10,
      };

      expect(dlqMessage.attempts).toBe(10);
    });
  });
});
