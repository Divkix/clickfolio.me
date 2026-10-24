import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { env } from "cloudflare:workers";
import { getR2Binding } from "@/lib/r2";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export const dynamic = "force-dynamic";

type ServiceStatus = "healthy" | "unhealthy" | "degraded";

interface ServiceHealth {
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: ServiceStatus;
  timestamp: string;
  services: {
    pg: ServiceHealth;
    r2: ServiceHealth;
    aiProvider: ServiceHealth;
  };
}

type AiProviderEnv = Pick<
  CloudflareEnv,
  "CF_AI_GATEWAY_ACCOUNT_ID" | "CF_AI_GATEWAY_ID" | "CF_AIG_AUTH_TOKEN"
>;

// Visitors get these fixed strings only: raw messages carry hostnames, bucket names and
// connection details. The cause goes to the log.
const UNAVAILABLE = "Service unavailable";

const NOT_CONFIGURED = "Not configured";

function missingR2(): ServiceHealth {
  log("error", "Health check failed", { service: "r2", reason: "binding missing" });

  return { status: "unhealthy", error: NOT_CONFIGURED };
}

async function checkPg(hyperdrive: Hyperdrive): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    const db = getDb(hyperdrive);
    await db.execute(sql`SELECT 1`);

    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (error) {
    log("error", "Health check failed", { service: "pg", ...errorFields(error) });

    return { status: "unhealthy", latencyMs: Date.now() - start, error: UNAVAILABLE };
  }
}

async function checkR2(r2: R2Bucket): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    await r2.list({ limit: 1 });

    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (error) {
    log("error", "Health check failed", { service: "r2", ...errorFields(error) });

    return { status: "unhealthy", latencyMs: Date.now() - start, error: UNAVAILABLE };
  }
}

function checkAiProviderConfig(env: AiProviderEnv): ServiceHealth {
  const hasGateway = env.CF_AI_GATEWAY_ACCOUNT_ID && env.CF_AI_GATEWAY_ID && env.CF_AIG_AUTH_TOKEN;

  if (hasGateway) return { status: "healthy" };

  log("error", "Health check failed", { service: "aiProvider", reason: "gateway not configured" });

  return { status: "unhealthy", error: NOT_CONFIGURED };
}

function aggregateStatus(services: HealthResponse["services"]): ServiceStatus {
  const statuses = Object.values(services).map((s) => s.status);

  if (statuses.every((s) => s === "healthy")) return "healthy";

  if (statuses.some((s) => s === "unhealthy")) return "unhealthy";

  return "degraded";
}

export async function GET() {
  try {
    // SAFETY: env is CloudflareEnv in Workers runtime; bindings verified by getR2Binding and health checks — cast bridges missing CloudflareEnv augmentation.
    const typedEnv = env as CloudflareEnv;

    const r2Binding = getR2Binding(typedEnv);

    const [r2Health, pgHealth] = await Promise.all([
      r2Binding ? checkR2(r2Binding) : Promise.resolve(missingR2()),
      checkPg(typedEnv.HYPERDRIVE),
    ]);

    const aiHealth = checkAiProviderConfig(typedEnv);

    const services = {
      r2: r2Health,
      pg: pgHealth,
      aiProvider: aiHealth,
    };

    const response: HealthResponse = {
      status: aggregateStatus(services),
      timestamp: new Date().toISOString(),
      services,
    };

    const httpStatus = response.status === "unhealthy" ? 503 : 200;

    return createSuccessResponse(response, httpStatus);
  } catch (error) {
    log("error", "Health check error:", { ...errorFields(error) });

    return createErrorResponse("Health check unavailable", ERROR_CODES.INTERNAL_ERROR, 503);
  }
}
