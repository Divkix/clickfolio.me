import { Layer } from "effect";
import { Db } from "../effect/db";
import { AlertWebhook } from "../effect/services/alert-webhook";
import { EdgePurgeQueue } from "../effect/services/edge-purge-queue";
import { IndexNow } from "../effect/services/indexnow";
import { Mailer } from "../effect/services/mailer";
import { R2Store } from "../effect/services/r2-store";
import { StatusChannel } from "../effect/services/status-channel";
import type { AlertEnv } from "./alert";

export type ParseWorkflowServices =
  | Db
  | StatusChannel
  | R2Store
  | AlertWebhook
  | Mailer
  | EdgePurgeQueue
  | IndexNow;

/** The alert settings are secrets/vars that `cf-typegen` does not know about. */
export type ParseWorkflowEnv = CloudflareEnv &
  Pick<AlertEnv, "ALERT_WEBHOOK_URL" | "ALERT_CHANNEL">;

/**
 * Everything a ResumeParseWorkflow step can ask for. Build it inside the step body, once per
 * step attempt, so the Postgres pool never outlives the attempt that opened it.
 */
export function parseWorkflowLayer(env: ParseWorkflowEnv): Layer.Layer<ParseWorkflowServices> {
  return Layer.mergeAll(
    Db.layer(env.HYPERDRIVE),
    StatusChannel.layer(env),
    R2Store.layer(env),
    AlertWebhook.layer(env),
    Mailer.layer(env),
    EdgePurgeQueue.layer(env.EDGE_PURGE_QUEUE),
    IndexNow.layer(),
  );
}
