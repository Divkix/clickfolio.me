import { Effect } from "effect";
import type { AuthenticatedUser } from "@/lib/auth/clerk";
import type { AdminUser } from "@/lib/auth/admin";
import { Forbidden, Unauthorized } from "@/lib/effect/failures";

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

/** What a test's "who is the admin" mock answers: an admin, or a refusal (403 forbidden, else 401). */
export type StubbedAdminSession =
  | { readonly error: null; readonly user: AdminUser }
  | { readonly error: Response };

/** A stand-in for `authenticateAdmin` in `@/lib/auth/admin`, which `withAdminEffect` calls first. */
export function authenticateAdminStub(read: () => Promise<StubbedAdminSession>) {
  return (): Effect.Effect<AdminUser, Unauthorized | Forbidden> =>
    Effect.promise(read).pipe(
      Effect.flatMap((session): Effect.Effect<AdminUser, Unauthorized | Forbidden> => {
        if (!session.error) return Effect.succeed(session.user);

        if (session.error.status === 403) {
          return Effect.fail(new Forbidden({ message: "Admin access required" }));
        }

        return Effect.fail(new Unauthorized({ message: "Unauthorized" }));
      }),
    );
}
