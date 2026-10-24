import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getAlertChannel,
  sendAlert,
  type AlertEnv,
  type ParseFailureAlert,
} from "@/lib/parse/alert";

const mocks = vi.hoisted(() => ({ log: vi.fn() }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

const WEBHOOK_URL = "https://hooks.example.com/services/T000/B000/SECRETTOKEN";

const ENV: AlertEnv = {
  // SAFETY: the alert path never reads the database binding.
  HYPERDRIVE: {} as CloudflareEnv["HYPERDRIVE"],
  CLICKFOLIO_STATUS_DO: undefined,
  ALERT_WEBHOOK_URL: WEBHOOK_URL,
};

const ALERT: ParseFailureAlert = {
  resumeId: "resume-1",
  userId: "user-1",
  failureReason: "boom",
  errorType: "parse_validation_error",
  totalAttempts: 3,
  timestamp: "2026-01-01T00:00:00.000Z",
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAlertChannel", () => {
  it("defaults to logpush", () => {
    expect(getAlertChannel(undefined)).toBe("logpush");
    expect(getAlertChannel("webhook")).toBe("webhook");
  });
});

describe("sendAlert", () => {
  it("logs the payload on the logpush channel without calling out", async () => {
    await sendAlert(ALERT, "logpush", ENV);

    expect(mocks.log).toHaveBeenCalledWith("error", "PARSE_FAILURE_ALERT", ALERT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the alert once on the webhook channel", async () => {
    fetchMock.mockResolvedValue(new Response("ok"));

    await sendAlert(ALERT, "webhook", ENV);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK_URL);
    expect(JSON.parse(String(init?.body))).toEqual({
      text: "Resume parsing permanently failed",
      ...ALERT,
    });
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("skips a webhook channel without a URL", async () => {
    await sendAlert(ALERT, "webhook", { ...ENV, ALERT_WEBHOOK_URL: undefined });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs a rejected webhook with the status and never the URL", async () => {
    fetchMock.mockResolvedValue(new Response("gone", { status: 404 }));

    await expect(sendAlert(ALERT, "webhook", ENV)).resolves.toBeUndefined();

    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "webhook alert failed",
      expect.objectContaining({
        failure: "HttpUpstreamFailed",
        kind: "rejected",
        "error.message": expect.stringContaining("404"),
      }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("SECRETTOKEN");
  });

  it("logs a network error without the URL and does not retry", async () => {
    fetchMock.mockRejectedValue(new Error(`fetch failed: ${WEBHOOK_URL}`));

    await sendAlert(ALERT, "webhook", ENV);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "webhook alert failed",
      expect.objectContaining({ kind: "unavailable", "error.message": "fetch failed: [webhook]" }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("SECRETTOKEN");
  });
});
