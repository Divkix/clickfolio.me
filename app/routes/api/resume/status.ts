import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { Forbidden, InvalidInput, NotFound } from "@/lib/effect/failures";
import type { UnknownRecord } from "@/lib/types/json";
import { getStatusView, WAITING_FOR_CACHE_TIMEOUT_MESSAGE } from "@/lib/resume/lifecycle";
import { createSuccessResponse } from "@/lib/utils/security-headers";

export const Route = createFileRoute("/api/resume/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return withUserEffect(
          request,
          ({ user: authUser }) =>
            Effect.gen(function* () {
              const userId = authUser.id;

              const { searchParams } = new URL(request.url);
              const resumeId = searchParams.get("resume_id");

              if (!resumeId) {
                return yield* Effect.fail(
                  new InvalidInput({ message: "resume_id parameter is required" }),
                );
              }

              const resume = yield* Db.use((service) =>
                service.query("resume.status.read", (db) =>
                  db.query.resumes.findFirst({
                    where: eq(resumes.id, resumeId),
                    columns: {
                      id: true,
                      userId: true,
                      status: true,
                      errorMessage: true,
                      parsedContent: true,
                      retryCount: true,
                      totalAttempts: true,
                      lastAttemptError: true,
                      createdAt: true,
                    },
                  }),
                ),
              );

              if (!resume) {
                return yield* Effect.fail(new NotFound({ message: "Resume not found" }));
              }

              if (resume.userId !== userId) {
                return yield* Effect.fail(
                  new Forbidden({ message: "You do not have permission to access this resume" }),
                );
              }

              // The DB row stays `waiting_for_cache` until the await-cache workflow persists
              // the timeout (lib/workflows/resume-parse-workflow). No `db.update` here.
              const view = getStatusView({
                status: resume.status,
                createdAt: resume.createdAt,
                retryCount: resume.retryCount,
                totalAttempts: resume.totalAttempts,
                lastAttemptError: resume.lastAttemptError,
              });

              if (view.isTimedOut) {
                return createSuccessResponse({
                  status: view.status,
                  progress_pct: view.progressPct,
                  error: WAITING_FOR_CACHE_TIMEOUT_MESSAGE,
                  can_retry: view.canRetry,
                });
              }

              if (view.status === "completed") {
                // SAFETY: parsedContent is schema-validated JSONB written by the parse pipeline; cast bridges the column's wide Record type.
                const parsedJson = (resume.parsedContent as UnknownRecord | null) ?? null;

                return createSuccessResponse({
                  status: "completed",
                  progress_pct: 100,
                  error: null,
                  can_retry: false,
                  parsed_content: parsedJson,
                });
              }

              if (view.status === "failed") {
                return createSuccessResponse({
                  status: view.status,
                  progress_pct: view.progressPct,
                  error: resume.errorMessage ?? null,
                  can_retry: view.canRetry,
                });
              }

              if (view.status === "processing") {
                const extra: UnknownRecord = {};

                if (view.waitingForCache) extra.waiting_for_cache = true;

                if (view.queued) extra.queued = true;

                return createSuccessResponse({
                  status: view.status,
                  progress_pct: view.progressPct,
                  error: null,
                  can_retry: false,
                  ...extra,
                });
              }

              return createSuccessResponse({
                status: view.status,
                progress_pct: view.progressPct,
                error: resume.errorMessage ?? null,
                can_retry: false,
              });
            }),
          "You must be logged in to check resume status",
        );
      },
    },
  },
});
