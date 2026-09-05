import { eq, inArray } from "drizzle-orm";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import type { Database } from "@/lib/db";
import { resumes, user, type NewResume, type UserRole } from "@/lib/db/schema";
import { notifyStatusChangeBatch } from "@/lib/queue/notify-status";
import type { ResumeContent } from "@/lib/types/database";

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

// Owns mark-completed: one atomic batch (resume rows + site-data upserts),
// the single name/role sync rule (role iff AI-provided, name iff missing),
// per-user publish-flag resolution, and the completed notification after the
// transaction so no caller can forget it.
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

  await db.transaction(async (tx) => {
    await tx.update(resumes).set(completionSet).where(inArray(resumes.id, resumeIds));
    for (const item of items) {
      await buildSiteDataUpsert(tx, item.userId, item.resumeId, parsedContent, {
        publish: publishFor(item.userId),
      });
    }
  });

  if (fanOut) {
    if (professionalLevel) {
      await db
        .update(user)
        .set({ role: professionalLevel, roleSource: "ai", updatedAt: now })
        .where(inArray(user.id, userIds));
    }
    if (parsedName && parsedName !== "Pending" && parsedName !== "Unnamed") {
      const needingName = [...(rowsById?.values() ?? [])]
        .filter(
          (row): row is CompletionUserRow & { id: string } =>
            !!row.id && shouldSyncDisplayName(parsedName, row.name),
        )
        .map((row) => row.id);
      if (needingName.length > 0) {
        await db
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
    await db.update(user).set(userUpdate).where(eq(user.id, items[0].userId));
  }

  await notifyStatusChangeBatch(resumeIds, "completed", {
    CLICKFOLIO_STATUS_DO: env.CLICKFOLIO_STATUS_DO,
  });
}
