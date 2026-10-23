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
  | "onboarding_completed"
  | "resume_uploaded"
  | "resume_upload_failed"
  | "resume_parse_completed"
  | "resume_parse_failed"
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
