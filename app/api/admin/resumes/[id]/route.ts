import { Effect } from "effect";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { withAdmin } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runRoute } from "@/lib/effect/edges";
import { externalCall } from "@/lib/effect/external";
import { Conflict, NotFound, R2Failed, type ServerFailure } from "@/lib/effect/failures";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { getR2Binding } from "@/lib/r2";
import { deleteR2Objects } from "@/lib/workflows/r2-delete";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";
import { createSuccessResponse } from "@/lib/utils/security-headers";

/** The row is already gone, so a failed cleanup is logged, never surfaced: a retry would only 404. */
function removeStoredFile(r2Key: string) {
  const r2 = getR2Binding(env);

  if (!r2) return Effect.void;

  return externalCall({
    operation: "admin.resume.r2-delete",
    timeoutMs: TIMEOUT_MS.r2,
    run: () => deleteR2Objects(r2, env.CLICKFOLIO_R2_DELETE_WORKFLOW, [r2Key]),
    fail: (details) => new R2Failed(details),
  }).pipe(
    Effect.catchTag("R2Failed", (error) =>
      Effect.sync(() => {
        log("error", "admin resume dismiss: R2 cleanup failed", {
          operation: error.operation,
          kind: error.kind,
          ...errorFields(error),
        });
      }),
    ),
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(request, async () => {
    const { id } = await params;

    return runRoute(request, dismissResume(id), Db.layer(env.HYPERDRIVE));
  });
}
