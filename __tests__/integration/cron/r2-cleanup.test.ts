/**
 * R2 cleanup cron task tests
 * Tests for lib/cron/cleanup-r2.ts - orphaned temp file cleanup
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockR2Bucket } from "@/__tests__/setup/mocks/r2.mock";
import { performR2Cleanup } from "@/lib/cron/cleanup-r2";

describe("R2 Cleanup Cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("performR2Cleanup", () => {
    it("should delete orphaned temp files older than 24 hours", async () => {
      const { bucket } = createMockR2Bucket();

      // Set up mock list to return temp files
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      bucket.list.mockResolvedValueOnce({
        objects: [
          { key: "temp/file1.pdf", size: 1000, uploaded: oldDate },
          { key: "temp/file2.pdf", size: 2000, uploaded: oldDate },
        ],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(2);
      expect(bucket.delete).toHaveBeenCalledWith("temp/file1.pdf");
      expect(bucket.delete).toHaveBeenCalledWith("temp/file2.pdf");
    });

    it("should not delete temp files newer than 24 hours", async () => {
      const { bucket } = createMockR2Bucket();

      // Set up mock list to return recent temp files
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago
      bucket.list.mockResolvedValueOnce({
        objects: [{ key: "temp/recent.pdf", size: 1000, uploaded: recentDate }],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(0);
      expect(bucket.delete).not.toHaveBeenCalled();
    });

    it("should handle empty temp folder", async () => {
      const { bucket } = createMockR2Bucket();

      bucket.list.mockResolvedValueOnce({
        objects: [],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(0);
    });

    it("should handle pagination for many temp files", async () => {
      const { bucket } = createMockR2Bucket();
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      // First page
      bucket.list
        .mockResolvedValueOnce({
          objects: [
            { key: "temp/file1.pdf", size: 1000, uploaded: oldDate },
            { key: "temp/file2.pdf", size: 1000, uploaded: oldDate },
          ],
          truncated: true,
          cursor: "page2",
          delimitedPrefixes: [],
        })
        // Second page
        .mockResolvedValueOnce({
          objects: [{ key: "temp/file3.pdf", size: 1000, uploaded: oldDate }],
          truncated: false,
          cursor: "",
          delimitedPrefixes: [],
        });

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(3);
      expect(bucket.delete).toHaveBeenCalledTimes(3);
    });

    it("should only delete files from temp/ prefix", async () => {
      const { bucket } = createMockR2Bucket();
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      bucket.list.mockResolvedValueOnce({
        objects: [
          { key: "temp/file.pdf", size: 1000, uploaded: oldDate },
          { key: "users/user-123/file.pdf", size: 1000, uploaded: oldDate },
        ],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result.deleted).toBe(1);
      expect(bucket.delete).toHaveBeenCalledWith("temp/file.pdf");
      expect(bucket.delete).not.toHaveBeenCalledWith("users/user-123/file.pdf");
    });

    it("should be idempotent - safe to run multiple times", async () => {
      const { bucket } = createMockR2Bucket();
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      // First run: files exist
      bucket.list.mockResolvedValueOnce({
        objects: [{ key: "temp/file.pdf", size: 1000, uploaded: oldDate }],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      await performR2Cleanup(bucket as unknown as R2Bucket);

      // Second run: no files
      bucket.list.mockResolvedValueOnce({
        objects: [],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      const result2 = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result2.ok).toBe(true);
      expect(result2.deleted).toBe(0);
    });

    it("should include timestamp in results", async () => {
      const { bucket } = createMockR2Bucket();

      bucket.list.mockResolvedValueOnce({
        objects: [],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it("should handle delete failures gracefully", async () => {
      const { bucket } = createMockR2Bucket();
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      bucket.list.mockResolvedValueOnce({
        objects: [
          { key: "temp/file1.pdf", size: 1000, uploaded: oldDate },
          { key: "temp/file2.pdf", size: 1000, uploaded: oldDate },
        ],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      // Make second delete fail
      bucket.delete
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Delete failed"));

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      // Should report 1 deleted (first succeeded) and 1 failed
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.ok).toBe(true); // Overall operation succeeded even with individual failures
    });

    it("should list with correct prefix and limit", async () => {
      const { bucket } = createMockR2Bucket();

      bucket.list.mockResolvedValueOnce({
        objects: [],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(bucket.list).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: "temp/",
          limit: expect.any(Number),
        }),
      );
    });

    it("should handle list errors gracefully", async () => {
      const { bucket } = createMockR2Bucket();

      bucket.list.mockRejectedValueOnce(new Error("R2 access denied"));

      await expect(performR2Cleanup(bucket as unknown as R2Bucket)).rejects.toThrow(
        "R2 access denied",
      );
    });

    it("should report bytes freed", async () => {
      const { bucket } = createMockR2Bucket();
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      bucket.list.mockResolvedValueOnce({
        objects: [
          { key: "temp/large.pdf", size: 1024 * 1024, uploaded: oldDate }, // 1MB
          { key: "temp/small.pdf", size: 1024, uploaded: oldDate }, // 1KB
        ],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result.bytesFreed).toBe(1024 * 1024 + 1024);
    });

    it("should handle exact 24-hour boundary correctly", async () => {
      const { bucket } = createMockR2Bucket();
      // Exactly 24 hours ago (edge case - should be deleted)
      const exactBoundary = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      bucket.list.mockResolvedValueOnce({
        objects: [{ key: "temp/boundary.pdf", size: 1000, uploaded: exactBoundary }],
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      });

      const result = await performR2Cleanup(bucket as unknown as R2Bucket);

      expect(result.deleted).toBe(1);
    });
  });
});
