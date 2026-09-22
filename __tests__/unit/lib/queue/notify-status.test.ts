import { describe, expect, it, vi } from "vite-plus/test";
import type { Mock } from "vite-plus/test";
import { notifyStatusChange, notifyStatusChangeBatch } from "@/lib/queue/notify-status";

type StatusEnv = {
  CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined;
};

function makeNamespace(idFromName: Mock, get: Mock): CloudflareEnv["CLICKFOLIO_STATUS_DO"] {
  return {
    newUniqueId: vi.fn(),
    idFromName,
    idFromString: vi.fn(),
    get,
    getByName: vi.fn(),
    jurisdiction: vi.fn(),
  };
}

function makeStatusEnv(binding: { idFromName: Mock; get: Mock }): StatusEnv {
  return {
    CLICKFOLIO_STATUS_DO: makeNamespace(binding.idFromName, binding.get),
  };
}

describe("Notify Status", () => {
  const createMockDOBinding = () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
    const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

    return {
      binding: makeNamespace(idFromNameMock, getMock),
      fetchMock,
      getMock,
      idFromNameMock,
    };
  };

  describe("notifyStatusChange", () => {
    it("should send notification to DO for status update", async () => {
      const { binding, fetchMock, idFromNameMock, getMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding };

      await notifyStatusChange({ resumeId: "resume-123", status: "processing", env });

      expect(idFromNameMock).toHaveBeenCalledWith("resume-123");
      expect(getMock).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith("https://do-internal/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"status":"processing"'),
      });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        status: "processing",
        version: expect.any(Number),
      });
    });

    it("should include error in payload when provided", async () => {
      const { binding, fetchMock } = createMockDOBinding();
      const env = { CLICKFOLIO_STATUS_DO: binding };

      await notifyStatusChange({
        resumeId: "resume-123",
        status: "failed",
        error: "PDF parsing failed",
        env,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"status":"failed"'),
        }),
      );
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        status: "failed",
        error: "PDF parsing failed",
        version: expect.any(Number),
      });
    });

    it("should return silently when DO binding not configured", async () => {
      const env = { CLICKFOLIO_STATUS_DO: undefined };
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

      const env = makeStatusEnv({ idFromName: idFromNameMock, get: getMock });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await notifyStatusChange({ resumeId: "resume-123", status: "processing", env });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should use unique DO ID for each resume", async () => {
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });
      const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });

      const env = makeStatusEnv({ idFromName: idFromNameMock, get: getMock });

      await notifyStatusChange({ resumeId: "resume-abc", status: "processing", env });
      await notifyStatusChange({ resumeId: "resume-def", status: "processing", env });

      expect(idFromNameMock).toHaveBeenCalledTimes(2);
      expect(idFromNameMock).toHaveBeenNthCalledWith(1, "resume-abc");
      expect(idFromNameMock).toHaveBeenNthCalledWith(2, "resume-def");
    });
  });

  describe("notifyStatusChangeBatch", () => {
    it("should notify multiple resumes", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
      const getMock = vi.fn().mockReturnValue({ fetch: fetchMock });
      const idFromNameMock = vi.fn().mockReturnValue({ toString: () => "do-id-123" });

      const env = makeStatusEnv({ idFromName: idFromNameMock, get: getMock });

      await notifyStatusChangeBatch(["resume-1", "resume-2", "resume-3"], "completed", env);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(idFromNameMock).toHaveBeenCalledWith("resume-1");
      expect(idFromNameMock).toHaveBeenCalledWith("resume-2");
      expect(idFromNameMock).toHaveBeenCalledWith("resume-3");
    });
  });
});
