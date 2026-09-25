import { waitUntil } from "cloudflare:workers";
import { PostHog } from "posthog-node";
import { z } from "zod";

import { POSTHOG_API_HOST, POSTHOG_PROJECT_TOKEN } from "@/lib/analytics/config";
import type { AnalyticsEventMap } from "@/lib/analytics/events";
import type { AnalyticsErrorValue, AnalyticsProperties } from "@/lib/analytics/client";
import { log } from "@/lib/utils/log";

const SHUTDOWN_TIMEOUT_MS = 1000;

/** posthog-js default persistence cookie: `ph_<project token>_posthog`. */
const POSTHOG_COOKIE_NAME = `ph_${POSTHOG_PROJECT_TOKEN}_posthog`;

const posthogCookieSchema = z.object({ distinct_id: z.string().min(1) });

function createPostHogClient(): PostHog | null {
  if (!POSTHOG_PROJECT_TOKEN) return null;

  return new PostHog(POSTHOG_PROJECT_TOKEN, {
    host: POSTHOG_API_HOST,
    flushAt: 1,
    flushInterval: 0,
    fetchRetryCount: 0,
    requestTimeout: SHUTDOWN_TIMEOUT_MS,
  });
}

function logFailure(stage: string, error: Error | string): void {
  log("warn", `analytics ${stage} failed`, {
    error: error instanceof Error ? error.message : error,
  });
}

export function captureServerEvent<E extends keyof AnalyticsEventMap>(
  distinctId: string,
  event: E,
  properties: AnalyticsEventMap[E],
): void {
  const posthog = createPostHogClient();

  if (!posthog) return;

  const send = (async () => {
    try {
      await posthog.captureImmediate({ distinctId, event, properties });
    } catch (error) {
      logFailure("capture", error instanceof Error ? error : String(error));
    } finally {
      try {
        await posthog.shutdown(SHUTDOWN_TIMEOUT_MS);
      } catch (error) {
        logFailure("shutdown", error instanceof Error ? error : String(error));
      }
    }
  })();

  try {
    waitUntil(send);
  } catch (error) {
    logFailure("waitUntil registration", error instanceof Error ? error : String(error));
  }
}

/**
 * Reads the browser's PostHog distinct id from the posthog-js persistence
 * cookie, as PostHog's Next.js error-tracking guide does in onRequestError, so
 * server exceptions attach to the same person as their client events.
 * Malformed or missing cookies yield undefined (a personless exception).
 */
export function distinctIdFromCookieHeader(
  cookieHeader: string | string[] | undefined,
): string | undefined {
  if (!cookieHeader) return undefined;

  const cookies = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;

  for (const cookie of cookies.split(";")) {
    const separator = cookie.indexOf("=");

    if (separator === -1 || cookie.slice(0, separator).trim() !== POSTHOG_COOKIE_NAME) continue;

    try {
      const parsed = posthogCookieSchema.safeParse(
        JSON.parse(decodeURIComponent(cookie.slice(separator + 1).trim())),
      );

      return parsed.success ? parsed.data.distinct_id : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export async function captureServerException(
  error: AnalyticsErrorValue,
  properties?: AnalyticsProperties,
  distinctId?: string,
): Promise<void> {
  const posthog = createPostHogClient();

  if (!posthog) return;

  try {
    await posthog.captureExceptionImmediate(error, distinctId, properties);
  } catch (captureError) {
    logFailure(
      "exception capture",
      captureError instanceof Error ? captureError : String(captureError),
    );
  } finally {
    try {
      await posthog.shutdown(SHUTDOWN_TIMEOUT_MS);
    } catch (shutdownError) {
      logFailure(
        "shutdown",
        shutdownError instanceof Error ? shutdownError : String(shutdownError),
      );
    }
  }
}
