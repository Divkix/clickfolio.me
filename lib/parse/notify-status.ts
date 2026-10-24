import { Effect } from "effect";
import type { ResumeStatus } from "../db/schema/resume";
import { upstreamLogFields } from "../effect/failure-fields";
import {
  MAX_NOTICE_ERROR_LENGTH,
  StatusChannel,
  type StatusNotice,
} from "../effect/services/status-channel";
import { log } from "../utils/log";

type StatusChange = { resumeId: string; status: ResumeStatus; error?: string };

/**
 * Pushes a status change to the resume's Durable Object, which fans it out to open sockets.
 * One push, no retry: the version stamp lets the object drop an out-of-order one, and the
 * client re-reads the status on reconnect. Fails with `DurableObjectFailed`.
 */
export function notifyStatus({ resumeId, status, error }: StatusChange) {
  return Effect.suspend(() => {
    const notice: StatusNotice = { status, version: Date.now() };

    // The object rejects longer messages, which would drop the whole status update.
    if (error) notice.error = error.slice(0, MAX_NOTICE_ERROR_LENGTH);

    return StatusChannel.use((channel) => channel.notify(resumeId, notice));
  });
}

/** `notifyStatus` for callers that must not fail because of it: logs the failure and drops it. */
export function notifyStatusBestEffort(change: StatusChange) {
  return notifyStatus(change).pipe(
    Effect.catchTag("DurableObjectFailed", (failure) =>
      Effect.sync(() =>
        log("error", "notify-status: failed to notify DO for resume", {
          resumeId: change.resumeId,
          ...upstreamLogFields(failure),
        }),
      ),
    ),
  );
}
