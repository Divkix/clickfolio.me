import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
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

    const [resume] = await db
      .select({ id: resumes.id, status: resumes.status, r2Key: resumes.r2Key })
      .from(resumes)
      .where(eq(resumes.id, id))
      .limit(1);

    if (!resume) {
      return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
    }
    if (resume.status !== "failed") {
      return createErrorResponse(
        "Only failed resumes can be dismissed",
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    const r2 = getR2Binding(env);
    if (r2 && resume.r2Key) {
      try {
        await R2.delete(r2, resume.r2Key);
      } catch (r2Error) {
        try {
          await db.insert(pendingR2Deletions).values({
            id: crypto.randomUUID(),
            r2Key: resume.r2Key,
            createdAt: new Date().toISOString(),
            attempts: 1,
          });
        } catch (insertError) {
          console.error(`Failed to delete R2 file ${resume.r2Key}:`, r2Error);
          console.error(`Failed to record pending R2 deletion for ${resume.r2Key}:`, insertError);
        }
      }
    }

    await db.delete(resumes).where(eq(resumes.id, id));

    return createSuccessResponse({ ok: true, id });
  });
}
