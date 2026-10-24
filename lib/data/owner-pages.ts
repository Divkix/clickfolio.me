import { count, desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { readStoredContent } from "@/lib/data/stored-content";
import { resumes, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";

// What the signed-in owner's pages read. Each loader takes the session's user id and returns
// plain data; the page decides what a missing row means (`redirect()` runs after the Effect).

/** The dashboard's user row with its latest resume and published site, content checked. */
export function loadDashboard(userId: string) {
  return Effect.gen(function* () {
    const userData = yield* Db.use((service) =>
      service.query("dashboard.load", (db) =>
        db.query.user.findFirst({
          where: eq(user.id, userId),
          with: {
            resumes: {
              orderBy: [desc(resumes.createdAt)],
              limit: 1,
            },
            siteData: {
              columns: {
                id: true,
                content: true,
                themeId: true,
                lastPublishedAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          columns: {
            id: true,
            handle: true,
            name: true,
            email: true,
            image: true,
            headline: true,
            privacySettings: true,
            onboardingCompleted: true,
            createdAt: true,
          },
        }),
      ),
    );

    const stored = userData?.siteData?.content;

    // `readStoredContent` fails on a malformed row; a falsy column has nothing to render.
    const content = stored ? yield* readStoredContent(stored, "dashboard.content") : null;

    return { userData, content };
  });
}

/** The resume content the editor starts from, or `null` when the owner has no published site. */
export function loadEditContent(userId: string) {
  return Effect.gen(function* () {
    const row = yield* Db.use((service) =>
      service.query("edit.load", (db) =>
        db.query.siteData.findFirst({
          where: eq(siteData.userId, userId),
          columns: { content: true },
        }),
      ),
    );

    if (!row) return null;

    return yield* readStoredContent(row.content, "edit.content");
  });
}

/** The current theme and the content it previews, or `null` when there is nothing to preview. */
export function loadThemeChoice(userId: string) {
  return Effect.gen(function* () {
    const row = yield* Db.use((service) =>
      service.query("themes.load", (db) =>
        db.query.siteData.findFirst({
          where: eq(siteData.userId, userId),
          columns: { themeId: true, content: true },
        }),
      ),
    );

    if (!row?.content) return null;

    const content = yield* readStoredContent(row.content, "themes.content");

    return { themeId: row.themeId, content };
  });
}

/** Everything the settings page shows, read as three independent queries. */
export function loadSettings(userId: string) {
  return Db.use((service) =>
    Effect.all(
      {
        profile: service.query("settings.profile", (db) =>
          db.query.user.findFirst({
            where: eq(user.id, userId),
            columns: {
              id: true,
              email: true,
              handle: true,
              headline: true,
              image: true,
              privacySettings: true,
              role: true,
              roleSource: true,
              isFreelance: true,
              updatedAt: true,
            },
          }),
        ),
        resumeCount: service.query("settings.resume-count", (db) =>
          db.select({ count: count() }).from(resumes).where(eq(resumes.userId, userId)),
        ),
        latestResume: service.query("settings.latest-resume", (db) =>
          db.query.resumes.findFirst({
            where: eq(resumes.userId, userId),
            orderBy: [desc(resumes.createdAt)],
            columns: {
              id: true,
              createdAt: true,
              status: true,
              errorMessage: true,
            },
          }),
        ),
      },
      { concurrency: "unbounded" },
    ),
  );
}
