/**
 * Shared by verified Clerk webhooks and session JIT provisioning. Preserve legacy external-id
 * mappings and downstream rows; never link accounts by email. A competing insert is resolved
 * by reading its mapping after PostgreSQL 23505, never by retrying a timed-out write.
 * Call database helpers inside Db.query so their I/O has a tagged failure and timeout.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { PgQueryable } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { user as users } from "@/lib/db/schema";
import { log } from "@/lib/utils/log";

const clerkEmailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
  verification: z.object({ status: z.string().nullish() }).nullish(),
});

export const clerkUserSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  image_url: z.string().nullish(),
  primary_email_address_id: z.string().nullish(),
  // Clerk sends only { deleted, id, object } on user.deleted, so this is absent there.
  email_addresses: z.array(clerkEmailAddressSchema).default([]),
  deleted: z.boolean().optional(),
});

export interface ClerkUserPayload {
  id: string;
  externalId: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    email_address: string;
    verification: { status: string | null } | null;
  }>;
}

export function toUserPayload(data: z.infer<typeof clerkUserSchema>): ClerkUserPayload {
  return {
    id: data.id,
    externalId: data.external_id ?? null,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    imageUrl: data.image_url ?? null,
    primaryEmailAddressId: data.primary_email_address_id ?? null,
    emailAddresses: data.email_addresses.map((email) => ({
      id: email.id,
      email_address: email.email_address,
      verification:
        email.verification == null ? null : { status: email.verification.status ?? null },
    })),
  };
}

function primaryEmailOf(payload: ClerkUserPayload): {
  email: string;
  verified: boolean;
} | null {
  const primary =
    payload.emailAddresses.find((e) => e.id === payload.primaryEmailAddressId) ??
    payload.emailAddresses[0];

  if (!primary) return null;

  return {
    email: primary.email_address,
    verified: primary.verification?.status === "verified",
  };
}

export async function findMappedUser(db: PgQueryable, payload: ClerkUserPayload) {
  const byClerkId = await db.query.user.findFirst({
    where: eq(users.clerkId, payload.id),
  });

  if (byClerkId) return byClerkId;

  if (payload.externalId) {
    const byExternalId = await db.query.user.findFirst({
      where: eq(users.id, payload.externalId),
    });

    if (byExternalId) return byExternalId;
  }

  return null;
}

interface ProfileColumns {
  name: string;
  image: string | null;
  emailVerified?: boolean;
}

function profileColumns(payload: ClerkUserPayload): ProfileColumns {
  const name = [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim();
  const primary = primaryEmailOf(payload);

  const columns: ProfileColumns = {
    name: name.length > 0 ? name : "Unnamed",
    image: payload.imageUrl,
  };

  if (primary) columns.emailVerified = primary.verified;

  return columns;
}

export async function upsertUser(db: PgQueryable, payload: ClerkUserPayload): Promise<string> {
  const existing = await findMappedUser(db, payload);
  const now = new Date().toISOString();
  const profile = profileColumns(payload);
  const primary = primaryEmailOf(payload);

  if (existing) {
    const base = { ...profile, clerkId: payload.id, updatedAt: now };

    if (!primary?.verified) {
      await db.update(users).set(base).where(eq(users.id, existing.id));

      return existing.id;
    }

    // The new primary is verified: it becomes the address parse-failure mail goes to.
    try {
      await db
        .update(users)
        .set({ ...base, email: primary.email, emailVerified: true })
        .where(eq(users.id, existing.id));
    } catch (error) {
      if (!(error instanceof Error && isUniqueViolation(error))) throw error;

      const mapped = await findMappedUser(db, payload);

      if (mapped && mapped.id !== existing.id) {
        log("warn", "[clerk] concurrent user mapping already exists", { userId: mapped.id });

        return mapped.id;
      }

      // Another account owns that address. Keep the old one but stop mailing it: it is
      // no longer the account's verified primary. Acked (2xx) so Svix does not retry.
      log("warn", "[clerk] primary email already belongs to another account", {
        userId: existing.id,
      });
      await db
        .update(users)
        .set({ ...base, emailVerified: false })
        .where(eq(users.id, existing.id));
    }

    return existing.id;
  }

  const values = {
    id: payload.externalId ?? payload.id,
    clerkId: payload.id,
    name: profile.name,
    email: primary?.email ?? `${payload.id}@unverified.clerk`,
    emailVerified: primary?.verified ?? false,
    image: profile.image,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.insert(users).values(values);
  } catch (error) {
    if (!(error instanceof Error && isUniqueViolation(error))) throw error;

    const mapped = await findMappedUser(db, payload);

    if (mapped) {
      log("warn", "[clerk] concurrent user mapping already exists", { userId: mapped.id });

      return mapped.id;
    }

    // Only the email conflicts, not the identity: preserve the other account's mapping.
    log("warn", "[clerk] primary email already belongs to another account", {
      userId: values.id,
    });

    try {
      await db.insert(users).values({
        ...values,
        email: `${payload.id}@unverified.clerk`,
        emailVerified: false,
      });
    } catch (fallbackError) {
      if (!(fallbackError instanceof Error && isUniqueViolation(fallbackError)))
        throw fallbackError;

      const raced = await findMappedUser(db, payload);

      if (!raced) throw fallbackError;

      log("warn", "[clerk] concurrent user mapping already exists", { userId: raced.id });

      return raced.id;
    }
  }

  return values.id;
}
