import { afterEach, describe, expect, it, vi } from "vite-plus/test";

// MAX_FILE_SIZE / MAX_FILE_SIZE_LABEL are module-level constants computed at
// import time from process.env.MAX_UPLOAD_SIZE_MB, so the env override must be
// set BEFORE the dynamic import (vi.resetModules() drops the cached module).

describe("lib/utils/validation", () => {
  afterEach(() => {
    delete process.env.MAX_UPLOAD_SIZE_MB;
    vi.resetModules();
  });

  it("defaults to 5MB label when MAX_UPLOAD_SIZE_MB is unset", async () => {
    delete process.env.MAX_UPLOAD_SIZE_MB;
    const { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } = await import("@/lib/utils/validation");

    expect(MAX_FILE_SIZE_LABEL).toBe("5MB");
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
  });

  it("derives the label from the MAX_UPLOAD_SIZE_MB env override", async () => {
    process.env.MAX_UPLOAD_SIZE_MB = "10";
    const { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } = await import("@/lib/utils/validation");

    expect(MAX_FILE_SIZE_LABEL).toBe("10MB");
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("keeps MAX_FILE_SIZE_LABEL in sync with MAX_FILE_SIZE for non-integer overrides", async () => {
    process.env.MAX_UPLOAD_SIZE_MB = "5.5";
    const { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } = await import("@/lib/utils/validation");

    expect(MAX_FILE_SIZE_LABEL).toBe("5.5MB");
    expect(MAX_FILE_SIZE).toBe(5.5 * 1024 * 1024);
  });

  it("falls back to 5MB for a non-numeric MAX_UPLOAD_SIZE_MB", async () => {
    process.env.MAX_UPLOAD_SIZE_MB = "not-a-number";
    const { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } = await import("@/lib/utils/validation");

    expect(MAX_FILE_SIZE_LABEL).toBe("5MB");
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
  });
});
