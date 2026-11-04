// Production deploy: scripts/deploy.ts runs `alchemy deploy --stage prod` after the Vite build.
// wrangler.jsonc stays the single source of config (Vite dev, `wrangler dev` and this stack all
// read it); only what Alchemy needs to adopt the live resources lives here.
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import { unstable_readConfig } from "wrangler";
import { z } from "zod";

const STAGE = "prod";

// unstable_readConfig types most collections loosely; validate exactly what this stack consumes.
const one = <T extends z.ZodType>(item: T) => z.tuple([item]).transform(([value]) => value);

const wrangler = z
  .object({
    name: z.string(),
    compatibility_date: z.string(),
    compatibility_flags: z.array(z.string()),
    workers_dev: z.boolean(),
    preview_urls: z.boolean(),
    logpush: z.boolean(),
    observability: z.object({
      enabled: z.boolean(),
      logs: z.object({
        enabled: z.boolean(),
        persist: z.boolean(),
        invocation_logs: z.boolean(),
        destinations: z.array(z.string()),
      }),
      traces: z.object({
        enabled: z.boolean(),
        persist: z.boolean(),
        destinations: z.array(z.string()),
      }),
    }),
    triggers: z.object({ crons: z.array(z.string()) }),
    vars: z.record(z.string(), z.string()),
    version_metadata: z.object({ binding: z.string() }),
    hyperdrive: one(z.object({ binding: z.string(), id: z.string() })),
    r2_buckets: one(z.object({ binding: z.string(), bucket_name: z.string() })),
    send_email: one(z.object({ name: z.string(), allowed_sender_addresses: z.array(z.string()) })),
    workflows: z.array(z.object({ name: z.string(), binding: z.string(), class_name: z.string() })),
    durable_objects: z.object({
      bindings: one(z.object({ name: z.string(), class_name: z.string() })),
    }),
    exports: z.record(
      z.string(),
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("worker"), cache: z.object({ enabled: z.boolean() }) }),
        z.object({
          type: z.literal("durable-object"),
          storage: z.enum(["sqlite", "legacy-kv"]),
        }),
      ]),
    ),
    queues: z.object({
      producers: one(z.object({ binding: z.string(), queue: z.string() })),
      consumers: one(
        z.object({
          queue: z.string(),
          max_batch_size: z.number(),
          max_batch_timeout: z.number(),
          max_concurrency: z.number(),
          max_retries: z.number(),
          retry_delay: z.number(),
          dead_letter_queue: z.string(),
        }),
      ),
    }),
  })
  .parse(unstable_readConfig({ config: "wrangler.jsonc" }));

const producer = wrangler.queues.producers;
const consumer = wrangler.queues.consumers;

if (consumer.queue !== producer.queue) {
  throw new Error("wrangler.jsonc: consumer and producer queues differ");
}

const durableObject = wrangler.durable_objects.bindings;
const durableObjectExport = wrangler.exports[durableObject.class_name];

if (durableObjectExport?.type !== "durable-object") {
  throw new Error(`wrangler.jsonc: exports must declare ${durableObject.class_name}`);
}

const entrypoints = Object.fromEntries(
  Object.entries(wrangler.exports).flatMap(([name, entry]) =>
    entry.type === "worker" ? [[name, { cache: entry.cache }]] : [],
  ),
);

export default Alchemy.Stack(
  "clickfolio",
  // State lives in the gitignored .alchemy/ directory. Losing it is recoverable with
  // `alchemy deploy --stage prod --adopt`, since every resource below has a fixed name.
  { providers: Cloudflare.providers(), state: Alchemy.localState() },
  Effect.gen(function* () {
    // Every name below is the live production name. Any other stage would fight prod for them.
    if ((yield* Alchemy.Stage) !== STAGE) {
      return yield* Effect.die(new Error(`Only --stage ${STAGE} is supported.`));
    }

    // Prod is the only stage: `alchemy destroy` and refactors forget resources instead of deleting them.
    const keep = Alchemy.RemovalPolicy.retain(true);

    // Alchemy owns every lifecycle rule on the bucket: a rule missing here is deleted on deploy.
    const bucket = yield* Cloudflare.R2.Bucket("Bucket", {
      name: wrangler.r2_buckets.bucket_name,
      lifecycleRules: [
        {
          id: "Default Multipart Abort Rule",
          abortMultipartUploadsTransition: { condition: { type: "Age", maxAge: 7 * 86400 } },
        },
        {
          // Anonymous uploads (lib/resume/claim-intake.ts) expire after a day.
          id: "expire-temp-uploads",
          prefix: "temp/",
          deleteObjectsTransition: { condition: { type: "Age", maxAge: 86400 } },
        },
      ],
    }).pipe(keep);

    const queue = yield* Cloudflare.Queues.Queue("Queue", { name: producer.queue }).pipe(keep);

    const deadLetterQueue = yield* Cloudflare.Queues.Queue("DeadLetterQueue", {
      name: consumer.dead_letter_queue,
    }).pipe(keep);

    const worker = yield* Cloudflare.Worker("Worker", {
      name: wrangler.name,
      // Prebuilt by `vp build` (@cloudflare/vite-plugin). worker/index.ts re-exports the Workflow,
      // Durable Object and CachedPages classes, which `bundle: false` requires.
      main: "./dist/server/index.js",
      bundle: false,
      assets: { directory: "./dist/client" },
      compatibility: {
        date: wrangler.compatibility_date,
        flags: wrangler.compatibility_flags,
      },
      workersDev: { enabled: wrangler.workers_dev, previewsEnabled: wrangler.preview_urls },
      placement: { mode: "smart" },
      logpush: wrangler.logpush,
      observability: {
        enabled: wrangler.observability.enabled,
        logs: {
          enabled: wrangler.observability.logs.enabled,
          persist: wrangler.observability.logs.persist,
          invocationLogs: wrangler.observability.logs.invocation_logs,
          destinations: wrangler.observability.logs.destinations,
        },
        traces: {
          enabled: wrangler.observability.traces.enabled,
          persist: wrangler.observability.traces.persist,
          destinations: wrangler.observability.traces.destinations,
        },
      },
      crons: wrangler.triggers.crons,
      entrypoints,
      // Custom domains (wrangler.jsonc `routes`) stay dashboard-managed: omitting `domain` leaves
      // them alone.
      env: {
        ...wrangler.vars,
        // Secrets stay `wrangler secret put` / dashboard managed: Alchemy never deletes secrets it
        // did not upload.
        [wrangler.hyperdrive.binding]: Cloudflare.Hyperdrive.lookup("Hyperdrive", {
          hyperdriveId: wrangler.hyperdrive.id,
        }),
        [wrangler.r2_buckets.binding]: bucket,
        [wrangler.send_email.name]: Cloudflare.Email.SendEmail(wrangler.send_email.name, {
          allowedSenderAddresses: wrangler.send_email.allowed_sender_addresses,
        }),
        [wrangler.version_metadata.binding]: Cloudflare.Workers.VersionMetadata(),
        [producer.binding]: queue,
        [durableObject.name]: Cloudflare.DurableObject(durableObject.class_name, {
          className: durableObject.class_name,
          storage: durableObjectExport.storage,
        }),
        ...Object.fromEntries(
          wrangler.workflows.map((workflow) => [
            workflow.binding,
            Cloudflare.Workflow(workflow.name, {
              workflowName: workflow.name,
              className: workflow.class_name,
            }),
          ]),
        ),
      },
    }).pipe(keep);

    yield* Cloudflare.Queues.Consumer("QueueConsumer", {
      queueId: queue.queueId,
      scriptName: worker.workerName,
      deadLetterQueue: deadLetterQueue.queueName,
      settings: {
        batchSize: consumer.max_batch_size,
        maxWaitTimeMs: consumer.max_batch_timeout * 1000,
        maxConcurrency: consumer.max_concurrency,
        maxRetries: consumer.max_retries,
        retryDelay: consumer.retry_delay,
      },
    }).pipe(keep);

    return { url: worker.url };
  }),
);
