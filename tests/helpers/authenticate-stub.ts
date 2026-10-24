import { Effect } from "effect";
import type { AuthenticatedUser } from "@/lib/auth/clerk";
import { Unauthorized } from "@/lib/effect/failures";

/** What a test's "who is signed in" mock answers: a user, or a signed-out visitor. */
export type StubbedSession =
  | {
      readonly error: null;
      readonly user: AuthenticatedUser["user"];
      readonly dbUser: AuthenticatedUser["dbUser"];
    }
  | { readonly error: Response };

/**
 * A stand-in for `authenticate` in `@/lib/auth/clerk`. `withUserEffect` calls it before every
 * handler, so a test that mocks it signs a user in without Clerk or a users table.
 *
 *   vi.mock("@/lib/auth/clerk", async (importOriginal) => ({
 *     ...(await importOriginal<typeof import("@/lib/auth/clerk")>()),
 *     authenticate: (await import("@/tests/helpers/authenticate-stub")).authenticateStub(read),
 *   }));
 */
export function authenticateStub(read: () => Promise<StubbedSession>) {
  return (options: { readonly unauthorizedMessage?: string } = {}) =>
    Effect.promise(read).pipe(
      Effect.flatMap((session) =>
        session.error
          ? Effect.fail(
              new Unauthorized({ message: options.unauthorizedMessage ?? "Unauthorized" }),
            )
          : Effect.succeed({ user: session.user, dbUser: session.dbUser }),
      ),
    );
}
