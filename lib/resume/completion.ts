import { and, eq, inArray, ne } from "drizzle-orm";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import type { Database } from "@/lib/db";
import { resumes, siteData, user, type NewResume, type UserRole } from "@/lib/db/schema";
import { notifyStatusChangeBatch } from "@/lib/parse/notify-status";
import type { ResumeContent } from "@/lib/types/database";
import { log } from "@/lib/utils/log";

export type ResumeCompletionItem = { resumeId: string; userId: string };

export type ResumeCompletionInput = {
  db: Database;
  env: { CLICKFOLIO_STATUS_DO?: CloudflareEnv["CLICKFOLIO_STATUS_DO"] };
  items: ResumeCompletionItem[];
  parsedContent: ResumeContent;
  professionalLevel?: UserRole | null;
  totalAttempts?: number;
  fanOut?: boolean;
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

type CompletionUserRow = {
  id?: string | null;
  handle: string | null;
  name: string | null;
};

// Owns mark-completed: one atomic batch (resume rows + site-data upserts + the
// user name/role sync), the single name/role sync rule (role iff AI-provided,
// name iff missing), per-user publish-flag resolution, and the completed
// notification after the transaction so no caller can forget it.
export async function completeResumes(input: ResumeCompletionInput): Promise<void> {
  const { db, env, items, parsedContent, professionalLevel, totalAttempts, fanOut } = input;
  const now = new Date().toISOString();
  const resumeIds = items.map((item) => item.resumeId);
  const userIds = [...new Set(items.map((item) => item.userId))];
  const parsedName = parsedContent.full_name?.trim();

  let publishFor: (userId: string) => boolean;
  let singleRow: CompletionUserRow | undefined;
  let rowsById: Map<string | null | undefined, CompletionUserRow> | undefined;

  if (fanOut) {
    const rows: CompletionUserRow[] = userIds.length
      ? await db
          .select({ id: user.id, handle: user.handle, name: user.name })
          .from(user)
          .where(inArray(user.id, userIds))
      : [];

    rowsById = new Map(rows.map((row) => [row.id, row]));
    publishFor = (userId: string) => !!rowsById?.get(userId)?.handle;
  } else {
    const rows: CompletionUserRow[] = await db
      .select({ handle: user.handle, name: user.name })
      .from(user)
      .where(eq(user.id, items[0].userId))
      .limit(1);

    singleRow = rows[0];
    publishFor = () => !!singleRow?.handle;
  }

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

  let completedIds: string[] = [];

  await db.transaction(async (tx) => {
    // Snapshot createdAt before the UPDATE: it is the reference point for the
    // manual-edit guard on site_data below.
    const createdRows = await tx
      .select({ id: resumes.id, createdAt: resumes.createdAt })
      .from(resumes)
      .where(inArray(resumes.id, resumeIds));

    const createdAtById = new Map(createdRows.map((row) => [row.id, row.createdAt]));

    const updated = await tx
      .update(resumes)
      .set(completionSet)
      .where(
        fanOut
          ? and(inArray(resumes.id, resumeIds), eq(resumes.status, "waiting_for_cache"))
          : and(inArray(resumes.id, resumeIds), ne(resumes.status, "completed")),
      )
      .returning({ id: resumes.id });

    // Nothing written (row gone via account deletion, or already completed):
    // no site-data upsert, no user sync, no completion notify.
    if (updated.length === 0) {
      return;
    }

    completedIds = updated.map((row) => row.id);

    const completedIdSet = new Set(completedIds);

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
    }

    if (fanOut) {
      if (professionalLevel && completedUserIds.length > 0) {
        await tx
          .update(user)
          .set({ role: professionalLevel, roleSource: "ai", updatedAt: now })
          .where(inArray(user.id, completedUserIds));
      }

      if (parsedName && parsedName !== "Pending" && parsedName !== "Unnamed") {
        const completedUserIdSet = new Set(completedUserIds);

        const needingName = [...(rowsById?.values() ?? [])].flatMap((row) =>
          row.id && completedUserIdSet.has(row.id) && shouldSyncDisplayName(parsedName, row.name)
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
    } else if (professionalLevel || shouldSyncDisplayName(parsedName, singleRow?.name)) {
      type UserUpdatePayload = Partial<typeof user.$inferInsert>;

      const userUpdate: UserUpdatePayload = {
        updatedAt: now,
      };

      if (professionalLevel) {
        userUpdate.role = professionalLevel;
        userUpdate.roleSource = "ai";
      }

      if (shouldSyncDisplayName(parsedName, singleRow?.name)) {
        userUpdate.name = parsedName;
      }

      await tx.update(user).set(userUpdate).where(eq(user.id, items[0].userId));
    }
  });

  if (completedIds.length === 0) {
    return;
  }

  await notifyStatusChangeBatch(completedIds, "completed", {
    CLICKFOLIO_STATUS_DO: env.CLICKFOLIO_STATUS_DO,
  });
}
