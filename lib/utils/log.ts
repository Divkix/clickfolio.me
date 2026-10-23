import type { UnknownRecord } from "@/lib/types/json";

type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, msg: string, fields: UnknownRecord = {}): void {
  const entry = { level, msg, ts: new Date().toISOString(), ...fields };
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
  | "onboarding_completed";

/**
 * One info line per business event. The name doubles as `msg` and a stable
 * `event` field so it can be filtered in HyperDX. Pass opaque ids and enums
 * only — never emails, names, handles or resume content.
 */
export function logEvent(event: BusinessEvent, fields: UnknownRecord = {}): void {
  log("info", event, { event, ...fields });
}
