import { Effect } from "effect";
import { and, eq, inArray, ne } from "drizzle-orm";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import type { CareerProfile } from "@/lib/ai/career";
import { resumes, siteData, user, type NewResume } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { notifyStatusBestEffort } from "@/lib/parse/notify-status";
import type { ResumeContent } from "@/lib/types/database";
import { log } from "@/lib/utils/log";

export type ResumeCompletionItem = { resumeId: string; userId: string };

export type ResumeCompletionInput = {
  items: ResumeCompletionItem[];
  parsedContent: ResumeContent;
  career?: CareerProfile | null;
  totalAttempts?: number;
  fanOut?: boolean;
  /**
   * The completing run's `retry_count` (single-row path only; a run carries the row's count).
   * A run whose count no longer matches was superseded by a sweep and a manual retry and must
   * not complete the row. Absent on runs started before the field existed: skip the check.
   */
  retryCount?: number;
};

// Single name-sync rule: display name updates iff the parsed name is real and
// the current name is missing. Callers pass the trimmed parsed name.
export function shouldSyncDisplayName(
  parsedName: string | null | undefined,
  currentName: string | null | undefined,
): parsedName is string {
  return (
    !!parsedName &&
    parsedName !== "Pending" &&
    parsedName !== "Unnamed" &&
    (!currentName || currentName === "Unnamed" || currentName.trim() === "")
  );
}

type CompletionOutcome = { ids: string[]; handles: string[] };

type CompletionUserRow = {
  id?: string | null;
  handle: string | null;
  name: string | null;
};

// Owns mark-completed: one atomic batch (resume rows + site-data upserts + the
// user name/role sync), the single name/role sync rule (role iff AI-provided,
// name iff missing), per-user publish-flag resolution, and the completed
// notification after the transaction so no caller can forget it. The notification
// is best effort; a database failure is the only way this fails. Resolves to the handles whose
// public site-data was rewritten (a missing handle or a newer manual edit leaves them out),
// for the caller to refresh the public pages. A single-row replay of a completion this run
// already committed resolves to the owner's handle again, so a retried step still refreshes it.
export function completeResumes(input: ResumeCompletionInput) {
  return Effect.gen(function* () {
    const { items, parsedContent, career, totalAttempts, fanOut, retryCount } = input;
    const now = new Date().toISOString();
    const resumeIds = items.map((item) => item.resumeId);
    const userIds = [...new Set(items.map((item) => item.userId))];
    const parsedName = parsedContent.full_name?.trim();

    const userRows: CompletionUserRow[] = yield* Db.use((db) =>
      db.query("resume.complete.users", async (handle) => {
        if (fanOut) {
          return userIds.length
            ? handle
                .select({ id: user.id, handle: user.handle, name: user.name })
                .from(user)
                .where(inArray(user.id, userIds))
            : [];
        }

        return handle
          .select({ handle: user.handle, name: user.name })
          .from(user)
          .where(eq(user.id, items[0].userId))
          .limit(1);
      }),
    );

    const singleRow: CompletionUserRow | undefined = fanOut ? undefined : userRows[0];
    const rowsById = new Map<string | null | undefined, CompletionUserRow>();

    if (fanOut) {
      for (const row of userRows) rowsById.set(row.id, row);
    }

    const publishFor = (userId: string): boolean =>
      fanOut ? !!rowsById.get(userId)?.handle : !!singleRow?.handle;

    const completionSet: Partial<NewResume> = {
      status: "completed",
      parsedAt: now,
      parsedContent,
      parsedContentStaged: null,
      lastAttemptError: null,
    };

    if (totalAttempts !== undefined) {
      completionSet.totalAttempts = totalAttempts;
    }

    const completion: CompletionOutcome = yield* Db.use((db) =>
      db.transaction("resume.complete", async (tx) => {
        // Snapshot the row before the UPDATE: createdAt is the reference point for the
        // manual-edit guard on site_data below, and status/retryCount tell a replay of
        // this run's own completion apart from a row another run owns.
        const createdRows = await tx
          .select({
            id: resumes.id,
            createdAt: resumes.createdAt,
            status: resumes.status,
            retryCount: resumes.retryCount,
          })
          .from(resumes)
          .where(inArray(resumes.id, resumeIds));

        const createdAtById = new Map(createdRows.map((row) => [row.id, row.createdAt]));

        const updated = await tx
          .update(resumes)
          .set(completionSet)
          .where(
            fanOut
              ? and(inArray(resumes.id, resumeIds), eq(resumes.status, "waiting_for_cache"))
              : and(
                  inArray(resumes.id, resumeIds),
                  ne(resumes.status, "completed"),
                  retryCount === undefined ? undefined : eq(resumes.retryCount, retryCount),
                ),
          )
          .returning({ id: resumes.id });

        // Nothing written (row gone via account deletion, or already completed): no
        // site-data upsert, no user sync, no completion notify. A row this run itself
        // completed in an earlier attempt (a step retried after its commit committed)
        // still resolves to its owner's handle so the caller's public refresh runs;
        // a superseded run (its retryCount moved on) or a fan-out batch resolves to none.
        if (updated.length === 0) {
          const owned = fanOut
            ? undefined
            : createdRows.find((row) => row.id === items[0].resumeId);

          const replaysOwnCompletion =
            owned?.status === "completed" &&
            (retryCount === undefined || owned.retryCount === retryCount);

          return replaysOwnCompletion && singleRow?.handle
            ? { ids: [], handles: [singleRow.handle] }
            : { ids: [], handles: [] };
        }

        const ids = updated.map((row) => row.id);
        const completedIdSet = new Set(ids);

        const completedUserIds = [
          ...new Set(
            items.filter((item) => completedIdSet.has(item.resumeId)).map((item) => item.userId),
          ),
        ];

        const siteRows = await tx
          .select({ userId: siteData.userId, updatedAt: siteData.updatedAt })
          .from(siteData)
          .where(inArray(siteData.userId, userIds));

        const siteUpdatedAtByUser = new Map(siteRows.map((row) => [row.userId, row.updatedAt]));

        const rewrittenHandles = new Set<string>();

        for (const item of items) {
          if (!completedIdSet.has(item.resumeId)) continue;
          const resumeCreatedAt = createdAtById.get(item.resumeId);
          const siteUpdatedAt = siteUpdatedAtByUser.get(item.userId);

          // A manual edit newer than the resume wins: parsing must not silently clobber it.
          if (siteUpdatedAt && resumeCreatedAt && siteUpdatedAt > resumeCreatedAt) {
            log("info", "skipping site-data upsert - manual edits are newer", {
              userId: item.userId,
              resumeId: item.resumeId,
            });
            continue;
          }

          await buildSiteDataUpsert(tx, item.userId, item.resumeId, parsedContent, {
            publish: publishFor(item.userId),
          });

          const handle = fanOut ? rowsById.get(item.userId)?.handle : singleRow?.handle;

          if (handle) rewrittenHandles.add(handle);
        }

        if (fanOut) {
          if (career && completedUserIds.length > 0) {
            await tx
              .update(user)
              .set({
                role: career.role,
                roleSource: "ai",
                isFreelance: career.isFreelance,
                updatedAt: now,
              })
              .where(inArray(user.id, completedUserIds));
          }

          if (parsedName && parsedName !== "Pending" && parsedName !== "Unnamed") {
            const completedUserIdSet = new Set(completedUserIds);

            const needingName = [...rowsById.values()].flatMap((row) =>
              row.id &&
              completedUserIdSet.has(row.id) &&
              shouldSyncDisplayName(parsedName, row.name)
                ? [row.id]
                : [],
            );

            if (needingName.length > 0) {
              await tx
                .update(user)
                .set({ name: parsedName, updatedAt: now })
                .where(inArray(user.id, needingName));
            }
          }
        } else if (career || shouldSyncDisplayName(parsedName, singleRow?.name)) {
          type UserUpdatePayload = Partial<typeof user.$inferInsert>;

          const userUpdate: UserUpdatePayload = {
            updatedAt: now,
          };

          if (career) {
            userUpdate.role = career.role;
            userUpdate.roleSource = "ai";
            userUpdate.isFreelance = career.isFreelance;
          }

          if (shouldSyncDisplayName(parsedName, singleRow?.name)) {
            userUpdate.name = parsedName;
          }

          await tx.update(user).set(userUpdate).where(eq(user.id, items[0].userId));
        }

        return { ids, handles: [...rewrittenHandles] };
      }),
    );

    yield* Effect.forEach(
      completion.ids,
      (resumeId) => notifyStatusBestEffort({ resumeId, status: "completed" }),
      { concurrency: 10, discard: true },
    );

    return completion.handles;
  });
}
