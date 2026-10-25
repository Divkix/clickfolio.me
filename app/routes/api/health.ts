import { createFileRoute } from "@tanstack/react-router";
import { Effect, Layer } from "effect";
import { sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { Db } from "@/lib/effect/db";
import { logFailure, runRoute } from "@/lib/effect/edges";
import type { DbConflict, DbFailed, R2Failed } from "@/lib/effect/failures";
import { R2Store } from "@/lib/effect/services/r2-store";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

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

const HEALTH_PATH = { path: "/api/health", method: "GET" } as const;

/** Runs one check; a failure is logged with its cause and shown as the fixed string only. */
function measure<R>(check: Effect.Effect<void, DbFailed | DbConflict | R2Failed, R>) {
  return Effect.suspend(() => {
    const start = Date.now();

    return check.pipe(
      Effect.map((): ServiceHealth => ({ status: "healthy", latencyMs: Date.now() - start })),
      Effect.catch((failure) =>
        Effect.sync((): ServiceHealth => {
          logFailure(failure, HEALTH_PATH);

          return { status: "unhealthy", latencyMs: Date.now() - start, error: UNAVAILABLE };
        }),
      ),
    );
  });
}

const checkPg = measure(
  Db.use((service) => service.query("health.pg", (db) => db.execute(sql`SELECT 1`))).pipe(
    Effect.asVoid,
  ),
);

const checkR2 = measure(R2Store.use((store) => store.ping()));

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

const unavailable = () =>
  createErrorResponse("Health check unavailable", ERROR_CODES.INTERNAL_ERROR, 503);

function healthProgram(typedEnv: CloudflareEnv) {
  return Effect.gen(function* () {
    const [r2Health, pgHealth] = yield* Effect.all(
      [typedEnv.CLICKFOLIO_R2_BUCKET ? checkR2 : Effect.sync(missingR2), checkPg],
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
    Effect.catchDefect((defect) =>
      Effect.sync(() => {
        log("error", "Health check error", { ...errorFields(defect) });

        return unavailable();
      }),
    ),
  );
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // SAFETY: env is CloudflareEnv in Workers runtime; cast bridges missing CloudflareEnv augmentation.
          const typedEnv = env as CloudflareEnv;

          return await runRoute(
            undefined,
            healthProgram(typedEnv),
            Layer.mergeAll(Db.layer(typedEnv.HYPERDRIVE), R2Store.layer(typedEnv)),
          );
        } catch (error) {
          log("error", "Health check error", { ...errorFields(error) });

          return unavailable();
        }
      },
    },
  },
});
