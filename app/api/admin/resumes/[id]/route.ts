import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { withAdmin } from "@/lib/auth/with-auth";
import { getDb } from "@/lib/db";
import { pendingR2Deletions, resumes } from "@/lib/db/schema";
import { getR2Binding, R2 } from "@/lib/r2";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(request, async () => {
    const { id } = await params;
    const db = getDb(env.HYPERDRIVE);

    // Conditional delete is the guard: a revived row matches nothing, so its R2 object
    // and DB row both survive.
    const [deleted] = await db
      .delete(resumes)
      .where(and(eq(resumes.id, id), eq(resumes.status, "failed")))
      .returning({ id: resumes.id, r2Key: resumes.r2Key });

    if (!deleted) {
      const [existing] = await db
        .select({ id: resumes.id })
        .from(resumes)
        .where(eq(resumes.id, id))
        .limit(1);
      if (!existing) {
        return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
      }
      return createErrorResponse("Only failed resumes can be dismissed", ERROR_CODES.CONFLICT, 409);
    }

    const r2 = getR2Binding(env);
    if (r2 && deleted.r2Key) {
      try {
        await R2.delete(r2, deleted.r2Key);
      } catch (r2Error) {
        try {
          await db
            .insert(pendingR2Deletions)
            .values({
              id: crypto.randomUUID(),
              r2Key: deleted.r2Key,
              createdAt: new Date().toISOString(),
              attempts: 1,
            })
            .onConflictDoNothing({ target: pendingR2Deletions.r2Key });
        } catch (insertError) {
          console.error(`Failed to delete R2 file ${deleted.r2Key}:`, r2Error);
          console.error(`Failed to record pending R2 deletion for ${deleted.r2Key}:`, insertError);
        }
      }
    }

    return createSuccessResponse({ ok: true, id });
  });
}
