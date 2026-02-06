import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getR2Binding } from "@/lib/r2";

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
    d1: ServiceHealth;
    r2: ServiceHealth;
    aiProvider: ServiceHealth;
  };
}

async function checkD1(db: D1Database): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await db.prepare("SELECT 1").first();
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

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
 * Check if AI provider is configured
 * We can't actually test the provider without making an API call,
 * so we just verify the required env vars are present
 */
function checkAiProviderConfig(env: Record<string, unknown>): ServiceHealth {
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
 * - D1 database
 * - R2 bucket
 * - AI provider configuration
 */
export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const typedEnv = env as CloudflareEnv;

    const r2Binding = getR2Binding(typedEnv);

    // Run all health checks in parallel
    const [d1Health, r2Health] = await Promise.all([
      checkD1(env.DB),
      r2Binding
        ? checkR2(r2Binding)
        : Promise.resolve({ status: "unhealthy" as const, error: "R2 binding not available" }),
    ]);

    // Check AI provider config (synchronous)
    const aiHealth = checkAiProviderConfig(env as unknown as Record<string, unknown>);

    const services = {
      d1: d1Health,
      r2: r2Health,
      aiProvider: aiHealth,
    };

    const response: HealthResponse = {
      status: aggregateStatus(services),
      timestamp: new Date().toISOString(),
      services,
    };

    const httpStatus =
      response.status === "healthy" ? 200 : response.status === "degraded" ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
