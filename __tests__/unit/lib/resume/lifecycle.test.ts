import { describe, expect, it } from "vite-plus/test";
import type { ResumeStatus } from "@/lib/db/schema/resume";
import {
  WAITING_FOR_CACHE_TIMEOUT_MS,
  WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
  RETRY_LIMITS,
  parseLastAttemptError,
  getLastAttemptErrorType,
  hasExceededMaxAttempts,
  isPermanentErrorType,
  checkRetryEligibility,
  canRetryResume,
  waitingForCacheTimedOut,
  statusPresentation,
  getStatusView,
  buildWaitingForCacheTimeoutUpdate,
} from "@/lib/resume/lifecycle";
describe("parseLastAttemptError", () => {
  it("null → null (both overloads)", () => {
    expect(parseLastAttemptError(null)).toBeNull();
    expect(parseLastAttemptError({ lastAttemptError: null })).toBeNull();
  });
  it('"" → null', () => {
    expect(parseLastAttemptError("")).toBeNull();
    expect(parseLastAttemptError({ lastAttemptError: "" })).toBeNull();
  });
  it("invalid JSON → null", () => {
    expect(parseLastAttemptError("not-json")).toBeNull();
    expect(parseLastAttemptError({ lastAttemptError: "{" })).toBeNull();
  });
  it("valid JSON with all fields via string and row overload", () => {
    const raw = JSON.stringify({
      type: "invalid_pdf",
      message: "bad pdf",
      isRetryable: false,
      name: "QueueError",
    });
    const expected = {
      type: "invalid_pdf",
      message: "bad pdf",
      isRetryable: false,
      raw,
      name: "QueueError",
    };
    expect(parseLastAttemptError(raw)).toEqual(expected);
    expect(parseLastAttemptError({ lastAttemptError: raw })).toEqual(expected);
  });
  it("missing fields default to null", () => {
    const raw = JSON.stringify({ message: "hi" });
    expect(parseLastAttemptError(raw)).toEqual({
      type: null,
      message: "hi",
      isRetryable: null,
      raw,
      name: null,
    });
  });
  it("non-object JSON → null", () => {
    expect(parseLastAttemptError("123")).toBeNull();
    expect(parseLastAttemptError(JSON.stringify(123))).toBeNull();
    expect(parseLastAttemptError('"hello"')).toBeNull();
  });
});
describe("getLastAttemptErrorType", () => {
  it("returns type", () => {
    expect(getLastAttemptErrorType(JSON.stringify({ type: "invalid_pdf" }))).toBe("invalid_pdf");
  });
  it("returns null when no type", () => {
    expect(getLastAttemptErrorType(null)).toBeNull();
    expect(getLastAttemptErrorType(JSON.stringify({ message: "x" }))).toBeNull();
  });
});
describe("hasExceededMaxAttempts / isPermanentErrorType", () => {
  it("5 → false", () => expect(hasExceededMaxAttempts(5)).toBe(false));
  it("6 → true", () => expect(hasExceededMaxAttempts(RETRY_LIMITS.TOTAL_MAX_ATTEMPTS)).toBe(true));
  it('isPermanentErrorType("invalid_pdf") true', () =>
    expect(isPermanentErrorType("invalid_pdf")).toBe(true));
  it('isPermanentErrorType("db_connection_error") false', () =>
    expect(isPermanentErrorType("db_connection_error")).toBe(false));
});
describe("checkRetryEligibility", () => {
  const base = {
    status: "failed" as ResumeStatus,
    retryCount: 0,
    totalAttempts: 1,
    lastAttemptError: null as string | null,
  };
  it("totalAttempts 6 → 429", () => {
    const r = checkRetryEligibility({ ...base, totalAttempts: 6 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.httpStatus).toBe(429);
  });
  it("permanent invalid_pdf → 400", () => {
    const r = checkRetryEligibility({
      ...base,
      lastAttemptError: JSON.stringify({
        type: "invalid_pdf",
        message: "bad pdf",
        isRetryable: false,
      }),
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.httpStatus).toBe(400);
  });
  it("status processing → 400", () => {
    const r = checkRetryEligibility({ ...base, status: "processing" });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.httpStatus).toBe(400);
  });
  it("retryCount 2 → 429", () => {
    const r = checkRetryEligibility({ ...base, retryCount: 2 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.httpStatus).toBe(429);
  });
  it("happy failed+transient → eligible true nextAttempt 1", () => {
    const r = checkRetryEligibility({
      ...base,
      lastAttemptError: JSON.stringify({ type: "db_connection_error" }),
    });
    expect(r).toEqual({ eligible: true, nextAttempt: 1 });
  });
  it("deprecated lastAttemptErrorType wins and explicit null honoured", () => {
    const transient = JSON.stringify({ type: "db_connection_error" });
    const blocked = checkRetryEligibility({
      ...base,
      lastAttemptError: transient,
      lastAttemptErrorType: "invalid_pdf",
    });
    expect(blocked.eligible).toBe(false);
    if (!blocked.eligible) expect(blocked.httpStatus).toBe(400);
    const explicitNull = checkRetryEligibility({
      ...base,
      lastAttemptError: transient,
      lastAttemptErrorType: null,
    });
    expect(explicitNull.eligible).toBe(true);
  });
});
describe("canRetryResume", () => {
  const base = {
    status: "failed" as ResumeStatus,
    retryCount: 0,
    totalAttempts: 1,
    lastAttemptError: null as string | null,
  };
  it("permanent false", () =>
    expect(
      canRetryResume({ ...base, lastAttemptError: JSON.stringify({ type: "invalid_pdf" }) }),
    ).toBe(false));
  it("happy true", () =>
    expect(
      canRetryResume({
        ...base,
        lastAttemptError: JSON.stringify({ type: "db_connection_error" }),
      }),
    ).toBe(true));
  it("status processing false", () =>
    expect(canRetryResume({ ...base, status: "processing" })).toBe(false));
});
describe("waitingForCacheTimedOut", () => {
  it("not waiting_for_cache → false", () =>
    expect(
      waitingForCacheTimedOut({ status: "processing", createdAt: new Date().toISOString() }),
    ).toBe(false));
  it("null createdAt → true", () =>
    expect(waitingForCacheTimedOut({ status: "waiting_for_cache", createdAt: null })).toBe(true));
  it("recent now → false", () =>
    expect(
      waitingForCacheTimedOut({ status: "waiting_for_cache", createdAt: new Date().toISOString() }),
    ).toBe(false));
  it("stale 11min ago → true", () => {
    const stale = new Date(Date.now() - (WAITING_FOR_CACHE_TIMEOUT_MS + 1000)).toISOString();
    expect(waitingForCacheTimedOut({ status: "waiting_for_cache", createdAt: stale })).toBe(true);
  });
  it('invalid date "not-a-date" → false', () =>
    expect(waitingForCacheTimedOut({ status: "waiting_for_cache", createdAt: "not-a-date" })).toBe(
      false,
    ));
});
describe("statusPresentation", () => {
  const row = (status: ResumeStatus, createdAt: string | null) => ({ status, createdAt });
  const fresh = new Date().toISOString();
  const stale = new Date(Date.now() - (WAITING_FOR_CACHE_TIMEOUT_MS + 1000)).toISOString();
  it("pending_claim 15 processing", () =>
    expect(statusPresentation(row("pending_claim", fresh))).toEqual({
      publicStatus: "processing",
      progressPct: 15,
      isTerminal: false,
    }));
  it("queued 25 +queued", () =>
    expect(statusPresentation(row("queued", fresh))).toEqual({
      publicStatus: "processing",
      progressPct: 25,
      queued: true,
      isTerminal: false,
    }));
  it("waiting_for_cache fresh 30 +waitingForCache", () =>
    expect(statusPresentation(row("waiting_for_cache", fresh))).toEqual({
      publicStatus: "processing",
      progressPct: 30,
      waitingForCache: true,
      isTerminal: false,
    }));
  it("waiting_for_cache stale → failed 0 +isWaitingForCacheTimeout", () =>
    expect(statusPresentation(row("waiting_for_cache", stale))).toEqual({
      publicStatus: "failed",
      progressPct: 0,
      isTerminal: true,
      isWaitingForCacheTimeout: true,
    }));
  it("processing 50", () =>
    expect(statusPresentation(row("processing", fresh))).toEqual({
      publicStatus: "processing",
      progressPct: 50,
      isTerminal: false,
    }));
  it("completed 100 terminal", () =>
    expect(statusPresentation(row("completed", fresh))).toEqual({
      publicStatus: "completed",
      progressPct: 100,
      isTerminal: true,
    }));
  it("failed 0 terminal", () =>
    expect(statusPresentation(row("failed", fresh))).toEqual({
      publicStatus: "failed",
      progressPct: 0,
      isTerminal: true,
    }));
});
describe("getStatusView", () => {
  const fresh = new Date().toISOString();
  const stale = new Date(Date.now() - (WAITING_FOR_CACHE_TIMEOUT_MS + 1000)).toISOString();
  it("waiting_for_cache fresh → processing 30 not timed out canRetry false", () => {
    const v = getStatusView({
      status: "waiting_for_cache",
      createdAt: fresh,
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: null,
    });
    expect(v).toEqual({
      status: "processing",
      progressPct: 30,
      isTimedOut: false,
      canRetry: false,
    });
  });
  it("waiting_for_cache stale with retryCount 0 → failed isTimedOut true canRetry true", () => {
    const v = getStatusView({
      status: "waiting_for_cache",
      createdAt: stale,
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: null,
    });
    expect(v).toEqual({ status: "failed", progressPct: 0, isTimedOut: true, canRetry: true });
  });
  it("failed with transient → canRetry true", () => {
    const v = getStatusView({
      status: "failed",
      createdAt: fresh,
      retryCount: 0,
      totalAttempts: 1,
      lastAttemptError: JSON.stringify({ type: "db_connection_error" }),
    });
    expect(v.status).toBe("failed");
    expect(v.isTimedOut).toBe(false);
    expect(v.canRetry).toBe(true);
  });
});
describe("buildWaitingForCacheTimeoutUpdate", () => {
  it('returns {status:"failed", errorMessage: WAITING_FOR_CACHE_TIMEOUT_MESSAGE}', () => {
    expect(buildWaitingForCacheTimeoutUpdate()).toEqual({
      status: "failed",
      errorMessage: WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
    });
  });
});
