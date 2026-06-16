/**
 * Minimal structured logger for the always-on backend (worker, queue, cron).
 * Emits a single JSON object so Cloudflare logs are queryable by field
 * (e.g. resumeId, cron, queue) instead of free-form strings.
 */
type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  const entry = { level, msg, ts: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
