/// <reference types="@cloudflare/workers-types" />

/**
 * The Worker's bindings, as declared in alchemy.run.ts. Keep the two in step: a binding added
 * there needs its type here.
 */
interface CloudflareEnv {
  ASSETS: Fetcher;
  CLICKFOLIO_R2_BUCKET: R2Bucket;
  HYPERDRIVE: Hyperdrive;
  EMAIL: SendEmail;
  EDGE_PURGE_QUEUE: Queue;
  CF_VERSION_METADATA: WorkerVersionMetadata;
  CLICKFOLIO_STATUS_DO: DurableObjectNamespace<import("../worker/index").ClickfolioStatusDO>;
  CLICKFOLIO_PARSE_WORKFLOW: Workflow<
    Parameters<import("../worker/index").ResumeParseWorkflow["run"]>[0]["payload"]
  >;
  CLICKFOLIO_R2_DELETE_WORKFLOW: Workflow<
    Parameters<import("../worker/index").R2DeleteWorkflow["run"]>[0]["payload"]
  >;

  NODE_ENV: string;
  APP_URL: string;
  EMAIL_FROM: string;
  CLERK_PUBLISHABLE_KEY: string;
  UMAMI_WEBSITE_ID: string;
  AI_MODEL: string;
  AI_REASONING_EFFORT: string;
  OTEL_COLLECTOR_URL: string;

  PENDING_UPLOAD_SECRET: string;
  CLERK_SECRET_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  CF_AI_GATEWAY_ACCOUNT_ID: string;
  CF_AI_GATEWAY_ID: string;
  CF_AIG_AUTH_TOKEN: string;
  UMAMI_API_URL: string;
  UMAMI_USERNAME: string;
  UMAMI_PASSWORD: string;
  DISABLE_RATE_LIMITS: string;
}

declare namespace Cloudflare {
  // Types `ctx.exports` (e.g. `ctx.exports.CachedPages`).
  interface GlobalProps {
    mainModule: typeof import("../worker/index");
    durableNamespaces: "ClickfolioStatusDO";
  }

  interface Env extends CloudflareEnv {}
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    APP_URL: string;
    EMAIL_FROM: string;
    CLERK_PUBLISHABLE_KEY: string;
    UMAMI_WEBSITE_ID: string;
    AI_MODEL: string;
    AI_REASONING_EFFORT: string;
    OTEL_COLLECTOR_URL: string;
    PENDING_UPLOAD_SECRET: string;
    CLERK_SECRET_KEY: string;
    CLERK_WEBHOOK_SECRET: string;
    CF_AI_GATEWAY_ACCOUNT_ID: string;
    CF_AI_GATEWAY_ID: string;
    CF_AIG_AUTH_TOKEN: string;
    UMAMI_API_URL: string;
    UMAMI_USERNAME: string;
    UMAMI_PASSWORD: string;
    DISABLE_RATE_LIMITS: string;
  }
}
