import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { resumes } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { getR2Bucket, getR2Client } from "@/lib/r2";
import { parseResume } from "@/lib/replicate";
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

    if (resume.retryCount >= 2) {
      return createErrorResponse(
        "Maximum retry limit reached. Please upload a new resume.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
        { max_retries: 2, current_retry_count: resume.retryCount },
      );
    }

    // 6. Generate presigned URL for existing R2 file
    const r2Client = getR2Client(typedEnv);
    const R2_BUCKET = getR2Bucket(typedEnv);

    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: resume.r2Key,
    });

    const presignedUrl = await getSignedUrl(r2Client, getCommand, {
      expiresIn: 7 * 24 * 60 * 60, // 7 days
    });

    // 7. Trigger new Replicate parsing job WITH webhook URL
    // Without webhook, if user closes browser the resume stays stuck "processing" forever
    let prediction;
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const webhookUrl = appUrl ? `${appUrl}/api/webhook/replicate` : undefined;
      prediction = await parseResume(presignedUrl, webhookUrl, typedEnv);
    } catch (error) {
      console.error("Failed to trigger retry parsing:", error);
      return createErrorResponse(
        `Failed to start retry: ${error instanceof Error ? error.message : "Unknown error"}`,
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        500,
      );
    }

    // 8. Update resume with new job ID and incremented retry count
    const updateResult = await db
      .update(resumes)
      .set({
        status: "processing",
        replicateJobId: prediction.id,
        errorMessage: null,
        retryCount: resume.retryCount + 1,
      })
      .where(eq(resumes.id, resume_id))
      .returning({ id: resumes.id });

    if (updateResult.length === 0) {
      console.error("Failed to update resume for retry");
      return createErrorResponse("Failed to update resume status", ERROR_CODES.DATABASE_ERROR, 500);
    }

    await captureBookmark();

    return createSuccessResponse({
      resume_id: resume.id,
      status: "processing",
      prediction_id: prediction.id,
      retry_count: resume.retryCount + 1,
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
