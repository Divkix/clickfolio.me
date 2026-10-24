import { isLocalEnvironment } from "@/lib/utils/environment";
import { log } from "@/lib/utils/log";

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost", "0.0.0.0", "::ffff:127.0.0.1"]);

/**
 * Limits only apply to a production deploy that serves real traffic. `DISABLE_RATE_LIMITS`
 * never switches them off there: it is logged and ignored.
 */
export function limitsBypassed(ip?: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  if (process.env.DISABLE_RATE_LIMITS === "true") {
    log("warn", "[SECURITY] DISABLE_RATE_LIMITS ignored in production environment");
  }

  return (ip !== undefined && LOCAL_IPS.has(ip)) || isLocalEnvironment();
}
