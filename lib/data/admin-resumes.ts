import { Effect } from "effect";
import { count, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { resumes, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { safePageParam } from "@/lib/utils/pagination";

const PAGE_SIZE = 25;

export const adminResumeStatusSchema = z.enum([
  "all",
  "completed",
  "processing",
  "queued",
  "failed",
]);

export const adminResumesParamsSchema = z.object({
  page: z
    .string()
    .nullish()
    .transform((value) => safePageParam(value))
    .catch(1),
  status: adminResumeStatusSchema.catch("all"),
});

export type AdminResumeStatus = z.infer<typeof adminResumeStatusSchema>;

export function loadAdminResumes({
  page,
  status: statusFilter,
}: z.infer<typeof adminResumesParamsSchema>) {
  return Effect.gen(function* () {
    const offset = (page - 1) * PAGE_SIZE;

    const statusCounts = yield* Db.use((db) =>
      db.query("admin.resumes.status-counts", (handle) =>
        handle
          .select({
            status: resumes.status,
            count: count(),
          })
          .from(resumes)
          .groupBy(resumes.status),
      ),
    );

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

    let statusCondition: SQL | undefined;

    if (statusFilter === "completed") {
      statusCondition = sql`${resumes.status} IN ('completed', 'waiting_for_cache')`;
    } else if (statusFilter === "processing") {
      statusCondition = eq(resumes.status, "processing");
    } else if (statusFilter === "queued") {
      statusCondition = sql`${resumes.status} IN ('queued', 'pending_claim')`;
    } else if (statusFilter === "failed") {
      statusCondition = eq(resumes.status, "failed");
    }

    const [[totalResult], resumeList] = yield* Effect.all(
      [
        Db.use((db) =>
          db.query("admin.resumes.count", (handle) =>
            handle.select({ count: count() }).from(resumes).where(statusCondition),
          ),
        ),
        Db.use((db) =>
          db.query("admin.resumes.list", (handle) =>
            handle
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
              // updated_at is NULL for rows that completed without a later write; fall back to created_at.
              .orderBy(sql`COALESCE(${resumes.updatedAt}, ${resumes.createdAt}) DESC`)
              .limit(PAGE_SIZE)
              .offset(offset),
          ),
        ),
      ],
      { concurrency: "unbounded" },
    );

    return {
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
    };
  });
}

export interface AdminResumesData {
  stats: { completed: number; processing: number; queued: number; failed: number };
  resumes: Array<{
    id: string;
    userEmail: string;
    status: string;
    retryCount: number;
    totalAttempts: number;
    lastAttemptError: string | null;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
