import type { UnknownRecord } from "@/lib/types/json";

type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, msg: string, fields: UnknownRecord = {}): void {
  const entry = { level, msg, ts: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
