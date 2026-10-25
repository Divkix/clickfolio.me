import { createIsomorphicFn } from "@tanstack/react-start";
import * as workers from "cloudflare:workers";
import type { UnknownRecord } from "@/lib/types/json";

type LogLevel = "info" | "warn" | "error";

type Deployment = {
  "service.version": string;
  "deployment.environment": string;
  "cloudflare.script_version.id"?: string;
  "faas.version"?: string;
};

let deployment: Deployment | undefined;

/**
 * The Worker's version metadata. The client build compiles this to a no-op and drops the
 * `cloudflare:workers` import; test mocks may omit `env` entirely.
 */
const versionMetadata = createIsomorphicFn().server(() =>
  "env" in workers ? workers.env.CF_VERSION_METADATA : undefined,
);

/**
 * Which build wrote the line. `service.version` and `deployment.environment`
 * match the browser SDK's resource attributes (lib/telemetry/browser.ts; the
 * SDK writes the pre-`deployment.environment.name` key). The version id is what
 * `wrangler rollback` takes, named as on Cloudflare's exported spans
 * (https://developers.cloudflare.com/workers/observability/traces/spans-and-attributes/).
 */
function deploymentFields(): Deployment {
  if (deployment) return deployment;
  const metadata = versionMetadata();

  deployment = {
    "service.version": __APP_VERSION__,
    "deployment.environment": __DEPLOY_ENV__,
    "cloudflare.script_version.id": metadata?.id,
    "faas.version": metadata?.tag || undefined,
  };

  return deployment;
}

export function log(level: LogLevel, msg: string, fields: UnknownRecord = {}): void {
  const entry = { level, msg, ts: new Date().toISOString(), ...deploymentFields(), ...fields };
  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

type BusinessEvent =
  | "resume_claimed"
  | "resume_claim_cached"
  | "resume_parse_retried"
  | "theme_changed"
  | "handle_changed"
  | "account_deleted"
  | "onboarding_completed"
  | "resume_uploaded"
  | "resume_upload_failed"
  | "resume_parse_completed"
  | "resume_parse_failed"
  | "resume_swept"
  | "ai_generation_completed"
  | "ai_generation_failed"
  | "cleanup_completed"
  | "cleanup_failed";

/**
 * One line per business event outcome. The name doubles as `msg` and a stable
 * `event` field so it can be filtered in HyperDX. Pass opaque ids, enums and
 * numbers (`duration_ms`, `size_bytes`, token counts) only — never emails,
 * names, handles or resume content. Failures keep their error level so
 * existing alerts still see them.
 */
export function logEvent(
  event: BusinessEvent,
  fields: UnknownRecord = {},
  level: LogLevel = "info",
): void {
  log(level, event, { event, ...fields });
}
