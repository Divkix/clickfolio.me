import { verifyToken } from "@clerk/backend";
import { cookies } from "next/headers";
import { vi } from "vite-plus/test";
import { user } from "@/lib/db/schema";
import type { TestDb } from "./pglite-db";

/**
 * Drives the real `withUser` / `withUserEffect` pipeline from a test: the session cookie, Clerk's
 * token verification and the user lookup all run, against whatever database the test points
 * `getDb` at. The test file must mock `@clerk/backend` (with `verifyToken`) and `next/headers`.
 */
const mockVerifyToken = vi.mocked(verifyToken);

const mockCookies = vi.mocked(cookies);

export const NOW = "2026-01-01T00:00:00.000Z";

/** Signs the next requests in as `clerkId`, or signs them out when `null`. */
export function signedInAs(clerkId: string | null) {
  // SAFETY: the code under test only calls get() on the cookie store.
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === "__session" && clerkId ? { name, value: "jwt" } : undefined),
  } as never);

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
