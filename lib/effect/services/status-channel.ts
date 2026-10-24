import { Context, Effect, Layer } from "effect";
import { z } from "zod";
import { isValidResumeStatus } from "@/lib/realtime/constants";
import { annotateActiveSpan } from "@/lib/telemetry/spans";
import { externalCall } from "../external";
import { DurableObjectFailed } from "../failures";
import { TIMEOUT_MS } from "../timeouts";

/** Longest `error` the Durable Object accepts; senders cut longer messages to fit. */
export const MAX_NOTICE_ERROR_LENGTH = 2_000;

/** What the Worker pushes to a resume's status Durable Object, and what the object accepts. */
export const statusNoticeSchema = z.object({
  status: z.string().refine(isValidResumeStatus, "Invalid status"),
  error: z.string().max(MAX_NOTICE_ERROR_LENGTH).optional(),
  // Date.now() of the sender: a late notice must not overwrite a newer one.
  version: z.number().finite().optional(),
});

export type StatusNotice = z.infer<typeof statusNoticeSchema>;

/** The part of a Durable Object namespace this service uses; tests pass a fake. */
export type StatusNamespace<Id> = {
  idFromName(name: string): Id;
  get(id: Id): { fetch(input: string, init?: RequestInit): Promise<Response> };
};

type StatusChannelService = {
  /**
   * One push, never retried: a timed-out notify may still have been applied, and the
   * version watermark in the object makes a late duplicate harmless but not useful.
   * Succeeds without sending when no namespace is bound (local runs).
   */
  readonly notify: (
    resumeId: string,
    notice: StatusNotice,
  ) => Effect.Effect<void, DurableObjectFailed>;
};

/** A non-2xx answer. `status` lets `classifyUpstreamCause` tell a rejection from an outage. */
class NotifyStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`status DO answered ${status}`);
    this.name = "NotifyStatusError";
    this.status = status;
  }
}

function service<Id>(
  namespace: StatusNamespace<Id> | undefined,
  timeoutMs: number,
): StatusChannelService {
  if (!namespace) return { notify: () => Effect.void };

  return {
    notify: (resumeId, notice) =>
      externalCall({
        operation: "status.notify",
        timeoutMs,
        run: async (signal) => {
          annotateActiveSpan({ "resume.id": resumeId, "resume.status": notice.status });

          const stub = namespace.get(namespace.idFromName(resumeId));

          const response = await stub.fetch("https://do-internal/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(notice),
            signal,
          });

          if (!response.ok) throw new NotifyStatusError(response.status);
        },
        fail: (details) => new DurableObjectFailed(details),
      }),
  };
}

/** Push channel to the per-resume `ClickfolioStatusDO` that fans status out to open sockets. */
export class StatusChannel extends Context.Service<StatusChannel, StatusChannelService>()(
  "clickfolio/StatusChannel",
) {
  static layer(env: {
    readonly CLICKFOLIO_STATUS_DO: CloudflareEnv["CLICKFOLIO_STATUS_DO"] | undefined;
  }): Layer.Layer<StatusChannel> {
    return Layer.succeed(
      StatusChannel,
      service(env.CLICKFOLIO_STATUS_DO, TIMEOUT_MS.durableObject),
    );
  }

  /** For tests: a fake namespace and, optionally, a shorter time limit. */
  static layerFrom<Id>(
    namespace: StatusNamespace<Id> | undefined,
    timeoutMs: number = TIMEOUT_MS.durableObject,
  ): Layer.Layer<StatusChannel> {
    return Layer.succeed(StatusChannel, service(namespace, timeoutMs));
  }
}
