import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { log } from "@/lib/utils/log";

describe("log", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes info level to console.log", () => {
    log("info", "test message");
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("routes warn level to console.warn", () => {
    log("warn", "test warning");
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("routes error level to console.error", () => {
    log("error", "test error");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("emits a single JSON string containing level, msg, and ts for info", () => {
    log("info", "x", { resumeId: "r1" });
    const call = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(call) as Record<string, unknown>;
    expect(parsed["level"]).toBe("info");
    expect(parsed["msg"]).toBe("x");
    expect(typeof parsed["ts"]).toBe("string");
    expect(parsed["resumeId"]).toBe("r1");
  });

  it("includes extra fields as top-level JSON keys", () => {
    log("error", "queue failed", { queue: "parse-queue", resumeId: "r2" });
    const call = consoleErrorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(call) as Record<string, unknown>;
    expect(parsed["level"]).toBe("error");
    expect(parsed["msg"]).toBe("queue failed");
    expect(parsed["queue"]).toBe("parse-queue");
    expect(parsed["resumeId"]).toBe("r2");
  });

  it("produces valid JSON when no extra fields are provided", () => {
    log("info", "simple message");
    const call = consoleLogSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(call)).not.toThrow();
    const parsed = JSON.parse(call) as Record<string, unknown>;
    expect(parsed["level"]).toBe("info");
    expect(parsed["msg"]).toBe("simple message");
  });

  it("emits a single argument (one JSON string) per call", () => {
    log("info", "x", { resumeId: "r1" });
    expect(consoleLogSpy.mock.calls[0]).toHaveLength(1);
  });

  it("ts field is an ISO 8601 string", () => {
    log("info", "timestamp check");
    const call = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(call) as Record<string, unknown>;
    expect(new Date(parsed["ts"] as string).toISOString()).toBe(parsed["ts"]);
  });
});
