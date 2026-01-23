import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { NewResume } from "@/lib/db/schema";
import { resumes } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import { getR2Binding, R2 } from "@/lib/r2";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

interface RetryRequestBody {
  resume_id?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Get D1 database binding and typed env for R2/Replicate
    const { env } = await getCloudflareContext({ async: true });
    const typedEnv = env as Partial<CloudflareEnv>;
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // Get R2 binding for direct operations
    const r2Binding = getR2Binding(typedEnv);
    if (!r2Binding) {
      return createErrorResponse(
        "Storage service unavailable",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 2. Check authentication via Better Auth
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return createErrorResponse(
        "You must be logged in to retry resume parsing",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const userId = session.user.id;

    const body = (await request.json()) as RetryRequestBody;
    const { resume_id } = body;

    if (!resume_id) {
      return createErrorResponse(
        "resume_id is required in request body",
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // 3. Fetch resume from database
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, resume_id),
      columns: {
        id: true,
        userId: true,
        r2Key: true,
        status: true,
        retryCount: true,
      },
    });

    if (!resume) {
      return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
    }

    // 4. Verify ownership
    if (resume.userId !== userId) {
      return createErrorResponse(
        "You do not have permission to retry this resume",
        ERROR_CODES.FORBIDDEN,
        403,
      );
    }

    // 5. Verify retry eligibility
    if (resume.status !== "failed") {
      return createErrorResponse(
        "Can only retry failed resumes",
        ERROR_CODES.VALIDATION_ERROR,
        400,
        { current_status: resume.status },
      );
    }

    if ((resume.retryCount as number) >= 2) {
      return createErrorResponse(
        "Maximum retry limit reached. Please upload a new resume.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
        { max_retries: 2, current_retry_count: resume.retryCount as number },
      );
    }

    let pdfBuffer: Uint8Array;

    try {
      const fileBuffer = await R2.getAsUint8Array(r2Binding, resume.r2Key as string);

      if (!fileBuffer) {
        return createErrorResponse(
          "Failed to download file for processing",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
        );
      }

      pdfBuffer = fileBuffer;
    } catch (error) {
      console.error("R2 download error:", error);
      return createErrorResponse(
        "Failed to download file for processing",
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // Get file hash for the queue message
    // Create a proper ArrayBuffer from the Uint8Array for crypto.subtle.digest
    const bufferCopy = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength,
    ) as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest("SHA-256", bufferCopy);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Publish to queue for background processing
    const queue = typedEnv.RESUME_PARSE_QUEUE;
    if (!queue) {
      return createErrorResponse("Queue service unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    await publishResumeParse(queue, {
      resumeId: resume.id as string,
      userId,
      r2Key: resume.r2Key as string,
      fileHash,
      attempt: (resume.retryCount as number) + 1,
    });

    const updatePayload: Partial<NewResume> = {
      status: "queued",
      errorMessage: null,
      retryCount: (resume.retryCount as number) + 1,
    };

    const updateResult = await db
      .update(resumes)
      .set(updatePayload)
      .where(eq(resumes.id, resume_id))
      .returning({ id: resumes.id });

    if (updateResult.length === 0) {
      console.error("Failed to update resume for retry");
      return createErrorResponse("Failed to update resume status", ERROR_CODES.DATABASE_ERROR, 500);
    }

    await captureBookmark();

    return createSuccessResponse({
      resume_id: resume.id as string,
      status: "queued",
      retry_count: (resume.retryCount as number) + 1,
    });
  } catch (error) {
    console.error("Error retrying resume parsing:", error);
    return createErrorResponse(
      "An unexpected error occurred while retrying",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
