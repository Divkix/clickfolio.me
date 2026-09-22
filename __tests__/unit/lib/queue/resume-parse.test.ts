import { describe, expect, it, vi } from "vite-plus/test";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import type { ResumeParseMessage } from "@/lib/queue/types";

describe("Resume Parse Queue", () => {
  const createMockQueue = () => ({
    metrics: vi.fn(),
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

      await publishResumeParse(queue, params);

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

      await publishResumeParse(queue, params);

      const message: ResumeParseMessage = queue.send.mock.calls[0][0];
      expect(message.attempt).toBe(1);
    });

    it("should propagate queue send errors", async () => {
      const queue = {
        metrics: vi.fn(),
        send: vi.fn().mockRejectedValue(new Error("Queue unavailable")),
        sendBatch: vi.fn(),
      };

      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
      };

      await expect(publishResumeParse(queue, params)).rejects.toThrow("Queue unavailable");
    });

    it("should propagate queue timeout errors", async () => {
      const queue = {
        metrics: vi.fn(),
        send: vi.fn().mockRejectedValue(new Error("timeout")),
        sendBatch: vi.fn(),
      };

      const params = {
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
      };

      await expect(publishResumeParse(queue, params)).rejects.toThrow("timeout");
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

      await publishResumeParse(queue, params);

      const message: ResumeParseMessage = queue.send.mock.calls[0][0];

      expect(message).toEqual({
        type: "parse",
        resumeId: "resume-123",
        userId: "user-456",
        r2Key: "uploads/resume.pdf",
        fileHash: "sha256-abc123",
        attempt: 2,
      });
    });
  });
});
