import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { resumes, user } from "../db/schema";
import { log } from "../utils/log";
import { errorFields } from "../utils/error-fields";

type ResumeEmailEnv = Pick<CloudflareEnv, "HYPERDRIVE" | "APP_URL" | "EMAIL_FROM"> & {
  EMAIL?: CloudflareEnv["EMAIL"];
};

/** Best effort: only the verified account owner receives a failure notification. */
export async function sendResumeFailureEmail(resumeId: string, env: ResumeEmailEnv): Promise<void> {
  if (!env.EMAIL) return;

  try {
    const db = getDb(env.HYPERDRIVE);

    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, resumeId),
      columns: { userId: true, status: true },
    });

    // Account deletion or a manual retry may have resolved the failure already.
    if (!resume || resume.status !== "failed") return;

    const owner = await db.query.user.findFirst({
      where: eq(user.id, resume.userId),
      columns: { email: true, emailVerified: true, clerkId: true },
    });

    if (!owner?.clerkId || !owner.emailVerified) return;

    const dashboardUrl = new URL("/dashboard", env.APP_URL).href;

    const result = await env.EMAIL.send({
      to: owner.email,
      from: env.EMAIL_FROM,
      subject: "Your resume needs another try",
      text: `We couldn't finish processing your resume. Open your clickfolio.me dashboard to see what went wrong and retry or upload a new PDF.\n\n${dashboardUrl}\n\nYour existing portfolio is still available if you already published one.`,
    });

    log("info", "resume failure email accepted", { resumeId, messageId: result.messageId });
  } catch (error) {
    // errorFields redacts addresses the provider echoes back in its message.
    log("error", "resume failure email failed", { resumeId, ...errorFields(error) });
  }
}
