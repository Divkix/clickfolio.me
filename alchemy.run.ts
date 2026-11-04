// The whole Cloudflare setup. scripts/deploy.ts runs `alchemy deploy --stage prod` (it builds the
// Vite app too); `pnpm dev` runs `alchemy dev`, which serves the same Worker locally from Vite.
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { CRONS, EDGE_PURGE_CONSUMER } from "./lib/worker-triggers";
import { PARSE_WORKFLOW_NAME } from "./lib/workflows/resume-parse-params";

// Every name below is the live production name, so prod is the only deployable stage.
const STAGE = "prod";

const VARS = {
  NODE_ENV: "production",
  APP_URL: "https://clickfolio.me",
  EMAIL_FROM: "notifications@clickfolio.me",
  CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuY2xpY2tmb2xpby5tZSQ",
  // Public: the tracker script prints it in every page.
  UMAMI_WEBSITE_ID: "1a0515d6-8471-4a14-8581-3fdc3929ff0c",
  ANALYTICS_SOURCE: "umami",
  GA4_PROPERTY_ID: "562314112",
  AI_MODEL: "openai/gpt-6-luna:nitro",
  AI_REASONING_EFFORT: "medium",
  // Browser telemetry ingest (/otel proxy). The key is the secret OTEL_BROWSER_INGEST_KEY.
  OTEL_COLLECTOR_URL: "https://observe.divkix.me/api/default",
};

// Production values live on the Worker (dashboard or Cloudflare API): Alchemy never deletes a
// secret it did not upload. Under `alchemy dev` they come from `.env`, each one optional.
const SECRETS = [
  // Required: HMAC key for signed pending-upload claim cookies.
  "PENDING_UPLOAD_SECRET",
  // Required: sk_… for session verification, and the Svix secret for /api/webhooks/clerk.
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "CRON_SECRET",
  "OTEL_BROWSER_INGEST_KEY",
  // Cloudflare AI Gateway (proxies to OpenRouter) for resume parsing.
  "CF_AI_GATEWAY_ACCOUNT_ID",
  "CF_AI_GATEWAY_ID",
  "CF_AIG_AUTH_TOKEN",
  "UMAMI_API_URL",
  "UMAMI_USERNAME",
  "UMAMI_PASSWORD",
  // Required only when ANALYTICS_SOURCE is ga4: whole service-account key file as one-line JSON.
  "GA4_SERVICE_ACCOUNT_JSON",
  // Optional parse-failure alerting: logpush (default) or webhook.
  "ALERT_CHANNEL",
  "ALERT_WEBHOOK_URL",
  // Development only; production ignores it (lib/rate-limit/bypass.ts).
  "DISABLE_RATE_LIMITS",
] as const;

// `.env` overrides any var (e.g. a Clerk test key, a localhost APP_URL) and supplies secrets.
const devEnv = Effect.gen(function* () {
  const env: Record<string, string | Redacted.Redacted<string>> = {};

  for (const [key, value] of Object.entries(VARS)) {
    env[key] = yield* Config.String(key).pipe(Config.withDefault(value));
  }

  for (const key of SECRETS) {
    const value = yield* Config.option(Config.Redacted(key));

    if (Option.isSome(value)) env[key] = value.value;
  }

  return env;
});

// Local Postgres behind the emulated Hyperdrive binding.
const devDatabase = Effect.gen(function* () {
  const url = new URL(
    yield* Config.String("LOCAL_DATABASE_URL").pipe(
      Config.withDefault("postgresql://postgres:postgres@localhost:5432/clickfolio"),
    ),
  );

  return {
    scheme: "postgres" as const,
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: Redacted.make(decodeURIComponent(url.password)),
    sslmode: "disable" as const,
  };
});

export default Alchemy.Stack(
  "clickfolio",
  // Deploys keep state in this account's Alchemy state store (`alchemy state bootstrap`), shared by
  // laptop and CI. Losing it is recoverable with `alchemy deploy --stage prod --adopt`, since every
  // resource below has a fixed name. `alchemy dev` keeps its own state in .alchemy/.
  {
    providers: Cloudflare.providers(),
    state: process.env.ALCHEMY_DEV === "true" ? Alchemy.localState() : Cloudflare.state(),
  },
  Effect.gen(function* () {
    const dev = yield* Alchemy.ALCHEMY_DEV;

    if (!dev && (yield* Alchemy.Stage) !== STAGE) {
      return yield* Effect.die(new Error(`Only --stage ${STAGE} is supported.`));
    }

    // `alchemy destroy` and refactors forget resources instead of deleting them.
    const keep = Alchemy.RemovalPolicy.retain(true);

    // Alchemy owns every lifecycle rule on the bucket: a rule missing here is deleted on deploy.
    const bucket = yield* Cloudflare.R2.Bucket("Bucket", {
      name: "clickfolio-bucket",
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

    const queue = yield* Cloudflare.Queues.Queue("Queue", { name: "clickfolio-cache-purge" }).pipe(
      keep,
    );

    const deadLetterQueue = yield* Cloudflare.Queues.Queue("DeadLetterQueue", {
      name: "clickfolio-cache-purge-dlq",
    }).pipe(keep);

    const worker = yield* Cloudflare.Website.Vite("Worker", {
      name: "clickfolio-me",
      // worker/index.ts wraps the TanStack Start handler and exports the Workflow, Durable Object
      // and CachedPages classes.
      main: "./worker/index.ts",
      compatibility: {
        date: "2026-01-22",
        flags: ["nodejs_compat", "global_fetch_strictly_public"],
      },
      // Alchemy defaults version preview URLs on; production never used them.
      workersDev: { enabled: true, previewsEnabled: false },
      placement: { mode: "smart" },
      dev: { port: 3000, strictPort: true },
      logpush: false,
      observability: {
        enabled: true,
        // Sent only to OpenObserve: `persist: false` keeps no Cloudflare copy, so it is not billed.
        logs: {
          enabled: true,
          persist: false,
          invocationLogs: true,
          destinations: ["openobserve-logs"],
        },
        traces: { enabled: true, persist: false, destinations: ["openobserve-traces"] },
      },
      crons: CRONS,
      // Workers Cache runs only in front of `CachedPages` (worker/cached-pages.ts); the default
      // entrypoint is the gateway and inherits caching off. Pages opt in with `edgeCacheHeaders()`.
      // https://developers.cloudflare.com/workers/cache/configuration/#per-entrypoint-caching
      entrypoints: { CachedPages: { cache: { enabled: true } } },
      // Custom domains (clickfolio.me, www) stay dashboard-managed: omitting `domain` leaves them alone.
      env: {
        ...(dev ? yield* devEnv : VARS),
        HYPERDRIVE: Cloudflare.Hyperdrive.lookup("Hyperdrive", {
          hyperdriveId: "8132893bf32b4e0b8b1b7edc8dad16c1",
          dev: dev ? yield* devDatabase : undefined,
        }),
        CLICKFOLIO_R2_BUCKET: bucket,
        EMAIL: Cloudflare.Email.SendEmail("EMAIL", {
          allowedSenderAddresses: ["notifications@clickfolio.me"],
        }),
        // Version id/tag of the running deployment on every log line (lib/utils/log.ts).
        CF_VERSION_METADATA: Cloudflare.Workers.VersionMetadata(),
        EDGE_PURGE_QUEUE: queue,
        // Created as ResumeStatusDO before SQLite-backed objects existed (renamed in v3), so it
        // keeps key-value storage. Deployed through `exports`, never `migrations`; the switch is
        // one-way.
        CLICKFOLIO_STATUS_DO: Cloudflare.DurableObject("ClickfolioStatusDO", {
          className: "ClickfolioStatusDO",
          storage: "legacy-kv",
        }),
        CLICKFOLIO_PARSE_WORKFLOW: Cloudflare.Workflow(PARSE_WORKFLOW_NAME, {
          workflowName: PARSE_WORKFLOW_NAME,
          className: "ResumeParseWorkflow",
        }),
        CLICKFOLIO_R2_DELETE_WORKFLOW: Cloudflare.Workflow("clickfolio-r2-delete", {
          workflowName: "clickfolio-r2-delete",
          className: "R2DeleteWorkflow",
        }),
      },
    }).pipe(keep);

    yield* Cloudflare.Queues.Consumer("QueueConsumer", {
      queueId: queue.queueId,
      scriptName: worker.workerName,
      deadLetterQueue: deadLetterQueue.queueName,
      settings: EDGE_PURGE_CONSUMER,
    }).pipe(keep);

    return { url: worker.url };
  }),
);
