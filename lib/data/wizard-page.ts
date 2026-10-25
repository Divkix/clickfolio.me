import { redirect } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { getServerSession } from "@/lib/auth/session";
import { loadEditContent } from "@/lib/data/owner-pages";
import { resumes } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import { getStatusView } from "@/lib/resume/lifecycle";
import { getOptionalEnvValue } from "@/lib/utils/env";
import { log } from "@/lib/utils/log";
import { COOKIE_NAME, parseSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
import { decideWizardStart } from "@/lib/wizard/initial-step";

/** Read-only initialization: claiming an upload must remain a client POST, never a page render. */
export function loadWizardPage(userId: string) {
  return Effect.gen(function* () {
    const cookie = getCookie(COOKIE_NAME);
    const secret = getOptionalEnvValue(env, "PENDING_UPLOAD_SECRET");

    if (cookie && !secret) {
      log("error", "PENDING_UPLOAD_SECRET is not configured; pending uploads cannot be verified");
    }

    const parsed =
      cookie && secret ? yield* Effect.promise(() => parseSignedCookieValue(cookie, secret)) : null;

    // The signed cookie stores only the key; claim intake hashes the uploaded bytes.
    const pendingUpload = parsed ? { key: parsed.tempKey, file_hash: null } : null;

    if (pendingUpload) {
      return decideWizardStart({ pendingUpload, siteContent: null, latestStatus: null });
    }

    const siteContent = yield* loadEditContent(userId);

    if (siteContent) {
      return decideWizardStart({ pendingUpload: null, siteContent, latestStatus: null });
    }

    const latestResume = yield* Db.use((service) =>
      service.query("wizard.latest-resume", (db) =>
        db.query.resumes.findFirst({
          where: eq(resumes.userId, userId),
          orderBy: [desc(resumes.createdAt)],
          columns: {
            id: true,
            status: true,
            createdAt: true,
            retryCount: true,
            totalAttempts: true,
            lastAttemptError: true,
          },
        }),
      ),
    );

    const latestStatus = latestResume
      ? { id: latestResume.id, status: getStatusView(latestResume).status }
      : null;

    return decideWizardStart({ pendingUpload: null, siteContent: null, latestStatus });
  });
}

export async function wizardPageData() {
  const session = await getServerSession();

  if (!session) throw redirect({ to: "/" });
  const initialStart = await runPage(loadWizardPage(session.user.id), Db.layer(env.HYPERDRIVE));

  if (initialStart.kind === "redirect-waiting") {
    throw redirect({ to: "/waiting", search: { resume_id: initialStart.resumeId } });
  }

  return { session, initialStart };
}
