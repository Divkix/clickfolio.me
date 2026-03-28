/**
 * Resume Parse Queue Tests
 *
 * Tests for the resume parsing queue publishing functionality.
 */

import { describe, expect, it, vi } from "vitest";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import type { ResumeParseMessage } from "@/lib/queue/types";

describe("Resume Parse Queue", () => {
  // Create a mock queue
  const createMockQueue = () => ({
    send: vi.fn().mockResolvedValue(undefined),
    sendBatch: vi.fn().mockResolvedValue(undefined),
  });

  describe("publishResumeParse", () => {
    it("should publish a resume parse message with all required fields", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      expect(queue.send).toHaveBeenCalledOnce();
      expect(queue.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "parse",
          resumeId: "resume-123",
          userId: "user-456",
          r2Key: "uploads/resume.pdf",
          fileHash: "sha256-abc123",
        }),
      );
    });

    it("should default attempt to 1 when not provided", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.attempt).toBe(1);
    });

    it("should use provided attempt count", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 3,
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.attempt).toBe(3);
    });

    it("should handle first retry (attempt 2)", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 2,
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.attempt).toBe(2);
      expect(message.type).toBe("parse");
    });

    it("should handle final retry attempt (attempt 3)", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 3,
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.attempt).toBe(3);
    });

    it("should handle UUID-formatted IDs", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        r2Key: "uploads/uuid-resume.pdf",
        fileHash: `sha256-${"a".repeat(64)}`,
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      expect(queue.send).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeId: "550e8400-e29b-41d4-a716-446655440000",
          userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        }),
      );
    });

    it("should handle nested R2 keys", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/2026/01/15/user-456/resume.pdf",
        fileHash: "sha256-abc123",
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.r2Key).toBe("uploads/2026/01/15/user-456/resume.pdf");
    });

    it("should handle long fileHash values", async () => {
      const queue = createMockQueue();
      const longHash = `sha256-${"x".repeat(1000)}`;
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: longHash,
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.fileHash).toBe(longHash);
    });

    it("should propagate queue send errors", async () => {
      const queue = {
        send: vi.fn().mockRejectedValue(new Error("Queue unavailable")),
      };
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
      };

      await expect(
        publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params),
      ).rejects.toThrow("Queue unavailable");
    });

    it("should propagate queue timeout errors", async () => {
      const queue = {
        send: vi.fn().mockRejectedValue(new Error("timeout")),
      };
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
      };

      await expect(
        publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params),
      ).rejects.toThrow("timeout");
    });

    it("should handle attempt 0 (edge case)", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 0,
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.attempt).toBe(0);
    });

    it("should handle very high attempt counts", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 100,
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.attempt).toBe(100);
    });

    it("should construct correct message structure", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 2,
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;

      expect(message).toEqual({
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 2,
      });
    });

    it("should handle R2 keys with special characters", async () => {
      const queue = createMockQueue();
      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/user@example.com/resume (1).pdf",
        fileHash: "sha256-abc123",
      };

      await publishResumeParse(queue as unknown as Queue<ResumeParseMessage>, params);

      const message = queue.send.mock.calls[0][0] as ResumeParseMessage;
      expect(message.r2Key).toBe("uploads/user@example.com/resume (1).pdf");
    });
  });
});
