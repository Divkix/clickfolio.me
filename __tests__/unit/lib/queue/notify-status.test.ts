/**
 * Notify Status Tests
 *
 * Tests for the status notification system that communicates
 * with Durable Objects for real-time updates.
 */

import { describe, expect, it, vi } from "vitest";
import { notifyStatusChange, notifyStatusChangeBatch } from "@/lib/queue/notify-status";

describe("Notify Status", () => {
  // Mock Durable Object binding
  const createMockDOBinding = () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
    const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

    return {
      binding: {
        idFromName: idFromNameMock,
        get: getMock,
      },
      fetchMock,
      getMock,
      idFromNameMock,
    };
  };

  describe("notifyStatusChange", () => {
    it("should send notification to DO for status update", async () => {
      const { binding, fetchMock, idFromNameMock, getMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;

      await notifyStatusChange({ resumeId: "resume-123", status: "processing", env });

      expect(idFromNameMock).toHaveBeenCalledWith("resume-123");
      expect(getMock).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith("https://do-internal/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processing" }),
      });
    });

    it("should include error in payload when provided", async () => {
      const { binding, fetchMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;

      await notifyStatusChange({
        resumeId: "resume-123",
        status: "failed",
        error: "PDF parsing failed",
        env,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ status: "failed", error: "PDF parsing failed" }),
        }),
      );
    });

    it("should not include error field when not provided", async () => {
      const { binding, fetchMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;

      await notifyStatusChange({ resumeId: "resume-123", status: "completed", env });

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).not.toHaveProperty("error");
      expect(body.status).toBe("completed");
    });

    it("should return silently when DO binding not configured", async () => {
      const env = { CLICKFOLIO_STATUS_DO: undefined } as unknown as CloudflareEnv;
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        notifyStatusChange({ resumeId: "resume-123", status: "processing", env }),
      ).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });

    it("should handle DO fetch errors gracefully", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("DO unavailable"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await notifyStatusChange({ resumeId: "resume-123", status: "processing", env });

      expect(consoleSpy).toHaveBeenCalled();
      const errorCall = consoleSpy.mock.calls.find((call) => call[0].includes("[notify-status]"));
      expect(errorCall).toBeDefined();
      expect(errorCall?.[0]).toContain("resume-123");

      consoleSpy.mockRestore();
    });

    it("should handle network timeout errors", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await notifyStatusChange({ resumeId: "resume-123", status: "processing", env });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle DO returning non-OK response", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await notifyStatusChange({ resumeId: "resume-123", status: "processing", env });

      expect(fetchMock).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should use unique DO ID for each resume", async () => {
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });
      const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      await notifyStatusChange({ resumeId: "resume-abc", status: "processing", env });
      await notifyStatusChange({ resumeId: "resume-def", status: "processing", env });

      expect(idFromNameMock).toHaveBeenCalledTimes(2);
      expect(idFromNameMock).toHaveBeenNthCalledWith(1, "resume-abc");
      expect(idFromNameMock).toHaveBeenNthCalledWith(2, "resume-def");
    });

    it("should not include empty error string in payload", async () => {
      const { binding, fetchMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;

      await notifyStatusChange({
        resumeId: "resume-123",
        status: "failed",
        error: "",
        env,
      });

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      // Empty string is falsy, so it won't be included
      expect(body).not.toHaveProperty("error");
    });

    it("should handle various status values", async () => {
      const statuses = ["pending", "processing", "completed", "failed", "waiting_for_cache"];
      const { binding, fetchMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;

      for (const status of statuses) {
        fetchMock.mockClear();

        await notifyStatusChange({ resumeId: "resume-123", status, env });

        const callArgs = fetchMock.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.status).toBe(status);
      }
    });

    it("should handle UUID resume IDs", async () => {
      const { binding, idFromNameMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;
      const uuid = "550e8400-e29b-41d4-a716-446655440000";

      await notifyStatusChange({ resumeId: uuid, status: "processing", env });

      expect(idFromNameMock).toHaveBeenCalledWith(uuid);
    });

    it("should handle long error messages", async () => {
      const { binding, fetchMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;
      const longError = "Error: ".repeat(1000);

      await notifyStatusChange({
        resumeId: "resume-123",
        status: "failed",
        error: longError,
        env,
      });

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.error).toBe(longError);
    });
  });

  describe("notifyStatusChangeBatch", () => {
    it("should notify multiple resumes", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      await notifyStatusChangeBatch(["resume-1", "resume-2", "resume-3"], "completed", env);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(idFromNameMock).toHaveBeenCalledWith("resume-1");
      expect(idFromNameMock).toHaveBeenCalledWith("resume-2");
      expect(idFromNameMock).toHaveBeenCalledWith("resume-3");
    });

    it("should handle empty array gracefully", async () => {
      const { binding } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;

      await expect(notifyStatusChangeBatch([], "completed", env)).resolves.toBeUndefined();
    });

    it("should handle single resume in batch", async () => {
      const { binding, fetchMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding } as unknown as CloudflareEnv;

      await notifyStatusChangeBatch(["resume-1"], "completed", env);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should continue if one notification fails", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("DO down"))
        .mockResolvedValueOnce(new Response("OK"))
        .mockRejectedValueOnce(new Error("Network error"));

      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await notifyStatusChangeBatch(["resume-1", "resume-2", "resume-3"], "completed", env);

      expect(fetchMock).toHaveBeenCalledTimes(3);

      consoleSpy.mockRestore();
    });

    it("should return silently when DO binding not configured", async () => {
      const env = { CLICKFOLIO_STATUS_DO: undefined } as unknown as CloudflareEnv;

      await expect(
        notifyStatusChangeBatch(["resume-1", "resume-2"], "completed", env),
      ).resolves.toBeUndefined();
    });

    it("should handle large batches", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      const resumes = Array.from({ length: 100 }, (_, i) => `resume-${i}`);

      await notifyStatusChangeBatch(resumes, "completed", env);

      expect(fetchMock).toHaveBeenCalledTimes(100);
    });

    it("should use Promise.allSettled for parallel execution", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      await notifyStatusChangeBatch(["resume-1", "resume-2", "resume-3"], "processing", env);

      // All calls should have been made (Promise.allSettled runs all in parallel)
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("should apply same status to all resumes", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = {
        CLICKFOLIO_STATUS_DO: {
          idFromName: idFromNameMock,
          get: getMock,
        },
      } as unknown as CloudflareEnv;

      await notifyStatusChangeBatch(["resume-1", "resume-2"], "waiting_for_cache", env);

      const call1Body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const call2Body = JSON.parse(fetchMock.mock.calls[1][1].body);

      expect(call1Body.status).toBe("waiting_for_cache");
      expect(call2Body.status).toBe("waiting_for_cache");
    });
  });
});
