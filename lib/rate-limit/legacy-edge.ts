import { env } from "cloudflare:workers";
import { Cause, type Effect, Exit } from "effect";
import { Db } from "@/lib/effect/db";
import { runBackground } from "@/lib/effect/edges";

/**
 * Transitional edge for callers that still await a result object. Routes that run under
 * `runRoute` use the `...Effect` limiters instead and delete the Promise functions built on this.
 * The program cannot fail: each limiter turns its typed refusals into data before it gets here.
 */
export async function runLimiter<A>(
  program: Effect.Effect<A, never, Db>,
  hyperdrive: Hyperdrive = env.HYPERDRIVE,
): Promise<A> {
  const exit = await runBackground(program, Db.layer(hyperdrive));

  if (Exit.isSuccess(exit)) return exit.value;

  throw Cause.squash(exit.cause);
}
