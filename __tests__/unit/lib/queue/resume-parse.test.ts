import { describe, expect, it, vi } from "vite-plus/test";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import type { ResumeParseMessage } from "@/lib/queue/types";

describe("Resume Parse Queue", () => {
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
  });
});
