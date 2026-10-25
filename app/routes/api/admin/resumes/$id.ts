import { createFileRoute } from "@tanstack/react-router";
import { Effect, Layer } from "effect";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { withAdminEffect } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { Conflict, NotFound, type ServerFailure } from "@/lib/effect/failures";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { R2Store } from "@/lib/effect/services/r2-store";
import { purgeR2Keys } from "@/lib/workflows/r2-purge";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";
import { createSuccessResponse } from "@/lib/utils/security-headers";

function logCleanupFailed(error: { readonly operation?: string; readonly cause?: unknown }): void {
  log("error", "admin resume dismiss: R2 cleanup failed", {
    operation: error.operation,
    ...errorFields(error),
  });
}

/**
 * The row is already gone, so a failed cleanup is logged, never surfaced: a retry would only 404.
 * `purgeR2Keys` deletes inline and hands a failed key to R2DeleteWorkflow; only when both are
 * unreachable does the object stay behind (it has logged that already).
 */
function removeStoredFile(r2Key: string) {
  return purgeR2Keys([r2Key]).pipe(
    Effect.asVoid,
    Effect.catchTags({
      WorkflowFailed: (error) => Effect.sync(() => logCleanupFailed(error)),
      InvalidInput: (error) => Effect.sync(() => logCleanupFailed(error)),
    }),
    Effect.provide(Layer.mergeAll(R2Store.layer(env), R2DeleteScheduler.layer(env))),
  );
}

function dismissResume(id: string): Effect.Effect<Response, ServerFailure, Db> {
  return Effect.gen(function* () {
    // Conditional delete is the guard: a revived row matches nothing, so its R2 object
    // and DB row both survive.
    const [deleted] = yield* Db.use((db) =>
      db.query("admin.resume.dismiss", (handle) =>
        handle
          .delete(resumes)
          .where(and(eq(resumes.id, id), eq(resumes.status, "failed")))
          .returning({ id: resumes.id, r2Key: resumes.r2Key }),
      ),
    );

    if (!deleted) {
      const [existing] = yield* Db.use((db) =>
        db.query("admin.resume.exists", (handle) =>
          handle.select({ id: resumes.id }).from(resumes).where(eq(resumes.id, id)).limit(1),
        ),
      );

      if (!existing) {
        return yield* Effect.fail(new NotFound({ message: "Resume not found" }));
      }

      return yield* Effect.fail(new Conflict({ message: "Only failed resumes can be dismissed" }));
    }

    if (deleted.r2Key) {
      yield* removeStoredFile(deleted.r2Key);
    }

    return createSuccessResponse({ ok: true, id });
  });
}

export const Route = createFileRoute("/api/admin/resumes/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const { id } = params;

        return withAdminEffect(request, () => dismissResume(id));
      },
    },
  },
});
