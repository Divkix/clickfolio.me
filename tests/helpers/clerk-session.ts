import { verifyToken } from "@clerk/backend";
import { vi } from "vite-plus/test";
import { user } from "@/lib/db/schema";
import type { TestDb } from "./pglite-db";

/**
 * Drives the real `withUserEffect` pipeline from a test: the session cookie, Clerk's
 * token verification and the user lookup all run, against whatever database the test points
 * `getDb` at. The test file must mock `@clerk/backend` (with `verifyToken`).
 */
const mockVerifyToken = vi.mocked(verifyToken);

export const NOW = "2026-01-01T00:00:00.000Z";

let signedIn = false;

/** Signs the next `sessionRequest`s in as `clerkId`, or signs them out when `null`. */
export function signedInAs(clerkId: string | null) {
  signedIn = clerkId !== null;

  if (clerkId) {
    mockVerifyToken.mockResolvedValue({
      __raw: "jwt",
      iss: "https://clerk.test",
      sub: clerkId,
      sid: "sess_1",
      nbf: 0,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
  }
}

/** `new Request(url, init)`, carrying the `__session` cookie while `signedInAs` has a user. */
export function sessionRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);

  if (signedIn) headers.set("Cookie", "__session=jwt");

  return new Request(url, { ...init, headers });
}

type SeedOverrides = Partial<typeof user.$inferInsert>;

/** A user row whose Clerk id is `clerk-<id>` and whose email is `<id>@example.com`. */
export async function seedUser(db: TestDb, id: string, overrides: SeedOverrides = {}) {
  const values: typeof user.$inferInsert = {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    clerkId: `clerk-${id}`,
    handle: `handle-${id}`,
    onboardingCompleted: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };

  await db.insert(user).values(values);
}
