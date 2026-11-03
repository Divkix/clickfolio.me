import { env, waitUntil } from "cloudflare:workers";
import { Cause, Exit, Layer } from "effect";
import { runBackground } from "@/lib/effect/edges";
import { Db } from "@/lib/effect/db";
import { Mailer } from "@/lib/effect/services/mailer";
import { portfolioLiveEmailBestEffort } from "@/lib/parse/email";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/** Background edge: typed failures are logged inside the program, defects here. */
async function run(userId: string): Promise<void> {
  const exit = await runBackground(
    portfolioLiveEmailBestEffort(userId, { appUrl: env.APP_URL, from: env.EMAIL_FROM }),
    Layer.mergeAll(Db.layer(env.HYPERDRIVE), Mailer.layer(env)),
  );

  if (Exit.isFailure(exit)) {
    log("error", "portfolio live email failed", {
      userId,
      ...errorFields(Cause.squash(exit.cause)),
    });
  }
}

/**
 * For request-time publishes (the wizard naming a handle after the parse already finished):
 * sends the once-per-user "live" email after the response. A no-op until the page holds parsed
 * content; the parse Workflow sends it then instead.
 */
export function emailPortfolioLiveInBackground(userId: string): void {
  // Without the binding (local dev) skip before the once-only claim is spent.
  if (!env.EMAIL) return;

  try {
    waitUntil(run(userId));
  } catch (error) {
    log("error", "portfolio live email waitUntil registration failed", { ...errorFields(error) });
  }
}
