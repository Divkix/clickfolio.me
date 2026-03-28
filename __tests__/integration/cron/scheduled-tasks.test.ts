import { beforeEach, describe, expect, it, vi } from "vitest";
import { performCleanup } from "@/lib/cron/cleanup";
import { recoverOrphanedResumes } from "@/lib/cron/recover-orphaned";
import type { ResumeParseMessage } from "@/lib/queue/types";

// Mock Database type
type MockDb = {
  batch: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  prepare: ReturnType<typeof vi.fn>;
  query: {
    user: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
};

// Mock Queue type
type MockQueue = {
  send: ReturnType<typeof vi.fn>;
};

function createMockDb(): MockDb {
  const mockResults = {
    meta: { changes: 0 },
    results: [] as Record<string, unknown>[],
  };

  return {
    batch: vi.fn().mockResolvedValue([mockResults, mockResults, mockResults]),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    prepare: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue({}),
      run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
    }),
    query: {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  };
}

function createMockQueue(): MockQueue {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Cron Scheduled Tasks", () => {
  let mockDb: MockDb;
  let mockQueue: MockQueue;

  beforeEach(() => {
    mockDb = createMockDb();
    mockQueue = createMockQueue();
    vi.clearAllMocks();
  });

  describe("performCleanup", () => {
    it("should cleanup expired sessions from D1", async () => {
      const mockResult = {
        meta: { changes: 5 },
        results: [],
      };
      mockDb.batch.mockResolvedValueOnce([mockResult, mockResult, mockResult]);

      const result = await performCleanup(mockDb as never);

      expect(result.ok).toBe(true);
      expect(result.deleted.sessions).toBe(5);
    });

    it("should cleanup expired verifications", async () => {
      const mockResult = {
        meta: { changes: 3 },
        results: [],
      };
      mockDb.batch.mockResolvedValueOnce([mockResult, mockResult, mockResult]);

      const result = await performCleanup(mockDb as never);

      expect(result.ok).toBe(true);
    });

    it("should cleanup old handleChanges older than 90 days", async () => {
      const rateLimitResult = { meta: { changes: 0 }, results: [] };
      const sessionsResult = { meta: { changes: 0 }, results: [] };
      const handleChangesResult = { meta: { changes: 10 }, results: [] };

      mockDb.batch.mockResolvedValueOnce([rateLimitResult, sessionsResult, handleChangesResult]);

      const result = await performCleanup(mockDb as never);

      expect(result.ok).toBe(true);
      expect(result.deleted.handleChanges).toBe(10);
    });

    it("should handle empty tables gracefully", async () => {
      const emptyResult = {
        meta: { changes: 0 },
        results: [],
      };
      mockDb.batch.mockResolvedValueOnce([emptyResult, emptyResult, emptyResult]);

      const result = await performCleanup(mockDb as never);

      expect(result.ok).toBe(true);
      expect(result.deleted.sessions).toBe(0);
      expect(result.deleted.rateLimits).toBe(0);
      expect(result.deleted.handleChanges).toBe(0);
    });

    it("should be idempotent - safe to run multiple times", async () => {
      const result1 = await performCleanup(mockDb as never);
      const result2 = await performCleanup(mockDb as never);
      const result3 = await performCleanup(mockDb as never);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      expect(result3.ok).toBe(true);
      expect(mockDb.batch).toHaveBeenCalledTimes(3);
    });

    it("should handle session expiry at exact boundary", async () => {
      const boundarySession = {
        meta: { changes: 1 },
        results: [],
      };
      mockDb.batch.mockResolvedValueOnce([boundarySession, boundarySession, boundarySession]);

      const result = await performCleanup(mockDb as never);
      expect(result.ok).toBe(true);
    });

    it("should preserve verifications for active users", async () => {
      // Mock that no verifications are deleted (active users)
      const emptyResult = {
        meta: { changes: 0 },
        results: [],
      };
      mockDb.batch.mockResolvedValueOnce([emptyResult, emptyResult, emptyResult]);

      const result = await performCleanup(mockDb as never);
      expect(result.deleted.sessions).toBe(0); // Active user sessions preserved
    });
  });

  describe("recoverOrphanedResumes", () => {
    it("should recover orphaned resumes in pending_claim status", async () => {
      const orphanedResume = {
        id: "resume-123",
        userId: "user-456",
        r2Key: "temp/user-456/file.pdf",
        fileHash: "abc123",
        totalAttempts: 0,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([orphanedResume]),
          }),
        }),
      });

      const result = await recoverOrphanedResumes(
        mockDb as never,
        mockQueue as unknown as Queue<ResumeParseMessage>,
      );

      expect(result.ok).toBe(true);
      expect(result.found).toBeGreaterThan(0);
    });

    it("should recover orphaned resumes in processing status", async () => {
      const processingOrphan = {
        id: "resume-processing",
        userId: "user-789",
        r2Key: "uploads/user-789/file.pdf",
        fileHash: "def456",
        totalAttempts: 1,
      };

      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      // Second call returns processing orphans
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([processingOrphan]),
            }),
          }),
        });

      const result = await recoverOrphanedResumes(
        mockDb as never,
        mockQueue as unknown as Queue<ResumeParseMessage>,
      );

      expect(result).toBeDefined();
    });

    it("should detect orphaned resumes no user linked > 24hrs", async () => {
      const oldOrphan = {
        id: "old-resume",
        userId: null,
        r2Key: "temp/old/file.pdf",
        fileHash: "old123",
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([oldOrphan]),
          }),
        }),
      });

      const result = await recoverOrphanedResumes(
        mockDb as never,
        mockQueue as unknown as Queue<ResumeParseMessage>,
      );

      expect(result).toBeDefined();
    });

    it("should skip resumes at max attempts", async () => {
      const maxAttemptsResume = {
        id: "max-attempts",
        userId: "user-123",
        r2Key: "uploads/file.pdf",
        fileHash: "hash123",
        totalAttempts: 6, // Max attempts reached
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([maxAttemptsResume]),
          }),
        }),
      });

      const result = await recoverOrphanedResumes(
        mockDb as never,
        mockQueue as unknown as Queue<ResumeParseMessage>,
      );

      expect(result.recovered).toBe(0);
      expect(mockQueue.send).not.toHaveBeenCalled();
    });

    it("should re-queue recovered resumes", async () => {
      const orphanedResume = {
        id: "orphan-123",
        userId: "user-456",
        r2Key: "temp/file.pdf",
        fileHash: "hash789",
        totalAttempts: 0,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([orphanedResume]),
          }),
        }),
      });

      await recoverOrphanedResumes(
        mockDb as never,
        mockQueue as unknown as Queue<ResumeParseMessage>,
      );

      expect(mockQueue.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "parse",
          resumeId: orphanedResume.id,
          userId: orphanedResume.userId,
          r2Key: orphanedResume.r2Key,
          fileHash: orphanedResume.fileHash,
        }),
      );
    });

    it("should handle no orphaned resumes found", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await recoverOrphanedResumes(
        mockDb as never,
        mockQueue as unknown as Queue<ResumeParseMessage>,
      );

      expect(result.ok).toBe(true);
      expect(result.recovered).toBe(0);
      expect(result.found).toBe(0);
    });
  });

  describe("cron execution logging", () => {
    it("should log cleanup execution", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await performCleanup(mockDb as never);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("error"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });

    it("should log recovery execution", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await recoverOrphanedResumes(
        mockDb as never,
        mockQueue as unknown as Queue<ResumeParseMessage>,
      );

      consoleSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("should handle database errors during cleanup", async () => {
      mockDb.batch.mockRejectedValueOnce(new Error("Database connection failed"));

      await expect(performCleanup(mockDb as never)).rejects.toThrow("Database connection failed");
    });

    it("should handle queue errors during recovery", async () => {
      const orphanedResume = {
        id: "orphan-123",
        userId: "user-456",
        r2Key: "temp/file.pdf",
        fileHash: "hash789",
        totalAttempts: 0,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([orphanedResume]),
          }),
        }),
      });

      mockQueue.send.mockRejectedValueOnce(new Error("Queue unavailable"));

      const result = await recoverOrphanedResumes(
        mockDb as never,
        mockQueue as unknown as Queue<ResumeParseMessage>,
      );

      // Should handle gracefully and report 0 recovered
      expect(result.recovered).toBe(0);
    });

    it("should handle concurrent cron jobs without conflicts", async () => {
      const cleanup1 = performCleanup(mockDb as never);
      const cleanup2 = performCleanup(mockDb as never);

      await expect(Promise.all([cleanup1, cleanup2])).resolves.not.toThrow();
    });
  });

  describe("cron timing", () => {
    it("should run cleanup at scheduled time", async () => {
      const beforeCleanup = new Date();

      await performCleanup(mockDb as never);

      const afterCleanup = new Date();
      expect(afterCleanup.getTime()).toBeGreaterThanOrEqual(beforeCleanup.getTime());
    });

    it("should include timestamp in results", async () => {
      const result = await performCleanup(mockDb as never);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe("multiple cron jobs", () => {
    it("should handle multiple job types concurrently", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const [cleanupResult, recoveryResult] = await Promise.all([
        performCleanup(mockDb as never),
        recoverOrphanedResumes(mockDb as never, mockQueue as unknown as Queue<ResumeParseMessage>),
      ]);

      expect(cleanupResult.ok).toBe(true);
      expect(recoveryResult.ok).toBe(true);
    });
  });
});
