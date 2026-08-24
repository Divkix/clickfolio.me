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

/**
 * Checks Postgres (via Hyperdrive) connectivity with a lightweight `SELECT 1`.
 *
 * @param hyperdrive - The HYPERDRIVE binding from the environment.
 * @returns ServiceHealth with latency and status.
 */
async function checkPg(hyperdrive: Hyperdrive): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const db = getDb(hyperdrive);
    await db.execute(sql`SELECT 1`);
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Checks R2 bucket connectivity by listing a single object.
 *
 * @param r2 - The R2 bucket binding.
 * @returns ServiceHealth with latency and status.
 */
async function checkR2(r2: R2Bucket): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await r2.list({ limit: 1 });
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if AI provider is configured.
 * We can't actually test the provider without making an API call,
 * so we just verify the required env vars are present.
 */
function checkAiProviderConfig(env: AiProviderEnv): ServiceHealth {
  const hasGateway = env.CF_AI_GATEWAY_ACCOUNT_ID && env.CF_AI_GATEWAY_ID && env.CF_AIG_AUTH_TOKEN;
  if (hasGateway) {
    return { status: "healthy", error: "Using Cloudflare AI Gateway" };
  }
  return {
    status: "unhealthy",
    error:
      "Cloudflare AI Gateway not configured (need CF_AI_GATEWAY_ACCOUNT_ID, CF_AI_GATEWAY_ID, CF_AIG_AUTH_TOKEN)",
  };
}

/**
 * Aggregates individual service statuses into an overall health status.
 *
 * @param services - The health statuses of all checked services.
 * @returns The aggregated status: "healthy", "unhealthy", or "degraded".
 */
function aggregateStatus(services: HealthResponse["services"]): ServiceStatus {
  const statuses = Object.values(services).map((s) => s.status);
  if (statuses.every((s) => s === "healthy")) return "healthy";
  if (statuses.some((s) => s === "unhealthy")) return "unhealthy";
  return "degraded";
}

/**
 * GET /api/health
 *
 * Returns health status of all services:
 * - Postgres database (via Hyperdrive)
 * - R2 bucket
 * - AI provider configuration
 *
 * Response shape: {@link HealthResponse}
 */
export async function GET() {
  try {
    // SAFETY: env is CloudflareEnv in Workers runtime; bindings verified by getR2Binding and health checks — cast bridges missing CloudflareEnv augmentation.
    const typedEnv = env as CloudflareEnv;

    const r2Binding = getR2Binding(typedEnv);

    // Run all health checks in parallel
    const [r2Health, pgHealth] = await Promise.all([
      r2Binding
        ? checkR2(r2Binding)
        : Promise.resolve({ status: "unhealthy" as const, error: "R2 binding not available" }),
      checkPg(typedEnv.HYPERDRIVE),
    ]);

    // Check AI provider config (synchronous)
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

    const httpStatus =
      response.status === "healthy" ? 200 : response.status === "degraded" ? 200 : 503;

    return createSuccessResponse(response, httpStatus);
  } catch (error) {
    console.error("Health check error:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      ERROR_CODES.INTERNAL_ERROR,
      503,
    );
  }
}
