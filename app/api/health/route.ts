import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { HealthCheckFailed } from "@/lib/api/errors";
import { runRoute } from "@/lib/api/route";
import { getR2Binding } from "@/lib/r2";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createSuccessResponse } from "@/lib/utils/security-headers";

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

// Public endpoint: a probe reports a fixed string and the real error goes to the logs.
const UNREACHABLE = "unreachable";

const NOT_CONFIGURED = "not configured";

function probe<A>(service: "pg" | "r2", check: () => Promise<A>): Effect.Effect<ServiceHealth> {
  return Effect.suspend(() => {
    const start = Date.now();

    return Effect.tryPromise(check).pipe(
      Effect.map((): ServiceHealth => ({ status: "healthy", latencyMs: Date.now() - start })),
      Effect.catch((error) => {
        const latencyMs = Date.now() - start;

        log("error", "Health probe failed", {
          service,
          duration_ms: latencyMs,
          ...errorFields(error.cause),
        });

        return Effect.succeed<ServiceHealth>({
          status: "unhealthy",
          latencyMs,
          error: UNREACHABLE,
        });
      }),
    );
  });
}

function checkAiProviderConfig(env: AiProviderEnv): ServiceHealth {
  const hasGateway = env.CF_AI_GATEWAY_ACCOUNT_ID && env.CF_AI_GATEWAY_ID && env.CF_AIG_AUTH_TOKEN;

  return hasGateway ? { status: "healthy" } : { status: "unhealthy", error: NOT_CONFIGURED };
}

function aggregateStatus(services: HealthResponse["services"]): ServiceStatus {
  const statuses = Object.values(services).map((s) => s.status);

  if (statuses.every((s) => s === "healthy")) return "healthy";

  if (statuses.some((s) => s === "unhealthy")) return "unhealthy";

  return "degraded";
}

export async function GET(request: Request) {
  return runRoute(
    request,
    Effect.gen(function* () {
      // SAFETY: env is CloudflareEnv in Workers runtime; bindings verified by getR2Binding and health checks — cast bridges missing CloudflareEnv augmentation.
      const typedEnv = env as CloudflareEnv;

      const r2Binding = getR2Binding(typedEnv);

      const [r2Health, pgHealth] = yield* Effect.all(
        [
          r2Binding
            ? probe("r2", () => r2Binding.list({ limit: 1 }))
            : Effect.succeed<ServiceHealth>({ status: "unhealthy", error: NOT_CONFIGURED }),
          probe("pg", () => getDb(typedEnv.HYPERDRIVE).execute(sql`SELECT 1`)),
        ],
        { concurrency: "unbounded" },
      );

      const services = {
        r2: r2Health,
        pg: pgHealth,
        aiProvider: checkAiProviderConfig(typedEnv),
      };

      const response: HealthResponse = {
        status: aggregateStatus(services),
        timestamp: new Date().toISOString(),
        services,
      };

      return createSuccessResponse(response, response.status === "unhealthy" ? 503 : 200);
    }).pipe(
      Effect.catchDefect((cause) =>
        Effect.fail(new HealthCheckFailed({ message: "Health check failed", cause })),
      ),
    ),
  );
}
