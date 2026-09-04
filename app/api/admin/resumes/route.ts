import { env } from "cloudflare:workers";
import { count, eq, sql } from "drizzle-orm";
import { withAdmin } from "@/lib/auth/with-auth";
import { getDb } from "@/lib/db";
import { resumes, user } from "@/lib/db/schema";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { safePageParam } from "@/lib/utils/pagination";

const PAGE_SIZE = 25;
const VALID_STATUSES = new Set(["all", "completed", "processing", "queued", "failed"]);

export async function GET(request: Request) {
  return withAdmin(request, async () => {
    const url = new URL(request.url);
    const page = safePageParam(url.searchParams.get("page"));
    const statusFilter = url.searchParams.get("status") || "all";
    const offset = (page - 1) * PAGE_SIZE;

    if (!VALID_STATUSES.has(statusFilter)) {
      return createErrorResponse("Invalid status filter", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const db = getDb(env.HYPERDRIVE);

    const statusCounts = await db
      .select({
        status: resumes.status,
        count: count(),
      })
      .from(resumes)
      .groupBy(resumes.status);

    const stats = {
      completed: 0,
      processing: 0,
      queued: 0,
      failed: 0,
    };

    for (const s of statusCounts) {
      if (s.status === "completed" || s.status === "waiting_for_cache") {
        stats.completed += s.count;
      } else if (s.status === "processing") {
        stats.processing += s.count;
      } else if (s.status === "queued" || s.status === "pending_claim") {
        stats.queued += s.count;
      } else if (s.status === "failed") {
        stats.failed += s.count;
      }
    }

    let statusCondition;
    if (statusFilter === "completed") {
      statusCondition = sql`${resumes.status} IN ('completed', 'waiting_for_cache')`;
    } else if (statusFilter === "processing") {
      statusCondition = eq(resumes.status, "processing");
    } else if (statusFilter === "queued") {
      statusCondition = sql`${resumes.status} IN ('queued', 'pending_claim')`;
    } else if (statusFilter === "failed") {
      statusCondition = eq(resumes.status, "failed");
    }

    const [totalResult] = await db.select({ count: count() }).from(resumes).where(statusCondition);

    const resumeList = await db
      .select({
        id: resumes.id,
        userId: resumes.userId,
        status: resumes.status,
        retryCount: resumes.retryCount,
        totalAttempts: resumes.totalAttempts,
        lastAttemptError: resumes.lastAttemptError,
        errorMessage: resumes.errorMessage,
        queuedAt: resumes.queuedAt,
        updatedAt: resumes.updatedAt,
        createdAt: resumes.createdAt,
        userEmail: user.email,
      })
      .from(resumes)
      .leftJoin(user, eq(resumes.userId, user.id))
      .where(statusCondition)
      .orderBy(sql`${resumes.updatedAt} DESC NULLS LAST, ${resumes.createdAt} DESC`)
      .limit(PAGE_SIZE)
      .offset(offset);

    return createSuccessResponse({
      stats,
      resumes: resumeList.map((r) => ({
        id: r.id,
        userEmail: r.userEmail || "Unknown",
        status: r.status,
        retryCount: r.retryCount,
        totalAttempts: r.totalAttempts,
        lastAttemptError: r.lastAttemptError || r.errorMessage,
        updatedAt: r.updatedAt || r.createdAt,
      })),
      total: totalResult?.count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    });
  });
}
