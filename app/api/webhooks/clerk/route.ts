/**
 * Clerk webhook receiver — syncs Clerk identities with local Postgres user
 * rows (sole source of truth since the D1 retirement).
 *
 * Events handled:
 *   - user.created / user.updated → upsert the local row keyed by
 *     `user.clerk_id`, preserving Clickfolio-specific fields (handle,
 *     referralCode, isAdmin, referredBy…) that Clerk does not own.
 *   - user.deleted                → delete the mapped row.
 *
 * Request authenticity is enforced with the Svix signature scheme (svix-id /
 * svix-timestamp / svix-signature headers) using CLERK_WEBHOOK_SECRET —
 * configure it with `wrangler secret put CLERK_WEBHOOK_SECRET` and point a
 * Clerk Dashboard webhook at https://clickfolio.me/api/webhooks/clerk.
 */

import { env } from "cloudflare:workers";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Database } from "@/lib/db";
import { user as users } from "@/lib/db/schema";
import { generateReferralCode } from "@/lib/utils/referral-code";

export const dynamic = "force-dynamic";

/** Svix-verified Clerk event envelope (subset this handler consumes). */
const verifiedEventSchema = z.object({
  type: z.string(),
  data: z.unknown().optional(),
});

/** A `user.deleted` event whose `deleted` flag is false is a deactivation, not a removal. */
const deactivatedSchema = z.object({ deleted: z.literal(false) });

/** Email address object from the official Clerk user webhook payload. */
const clerkEmailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
  verification: z.object({ status: z.string().nullish() }).nullish(),
});

/** Official snake_case Clerk user object delivered by user.* events. */
const clerkUserSchema = z.object({
  id: z.string(),
  external_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  image_url: z.string().nullish(),
  primary_email_address_id: z.string().nullish(),
  email_addresses: z.array(clerkEmailAddressSchema),
  deleted: z.boolean().optional(),
});

/** Fields of the Clerk user payload used for the upsert. */
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

/** Map the verified Clerk user object onto the app-facing payload shape. */
function toUserPayload(data: z.infer<typeof clerkUserSchema>): ClerkUserPayload {
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
    // Imported users are provisioned verified; new Google users always are.
    verified: primary.verification?.status === "complete",
  };
}

/**
 * Locate the local row to attach the Clerk identity to, in priority order:
 *   1. already-mapped row (`clerk_id` match),
 *   2. imported legacy id (Clerk `externalId` = pre-migration user.id).
 *
 * Deliberately NO email fallback: matching on email could merge an unrelated
 * Clerk identity into an existing account.
 */
async function findMappedUser(db: Database, payload: ClerkUserPayload) {
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

/**
 * Identity-owned columns written on every event. App-owned columns (handle,
 * referralCode, isAdmin, referredBy, privacySettings…) are deliberately NOT
 * here so Clerk events can never clobber them.
 */
interface ProfileColumns {
  name: string;
  image: string | null;
  /** Omitted when no primary email exists so updates never clobber a stored value. */
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

/**
 * Upsert the local row for a Clerk identity and return its app user id.
 * Imported users keep their legacy id; brand-new users use the Clerk id as
 * both `id` and `clerk_id` so every foreign key has one stable value.
 */
async function upsertUser(db: Database, payload: ClerkUserPayload): Promise<string> {
  const existing = await findMappedUser(db, payload);
  const now = new Date().toISOString();
  const profile = profileColumns(payload);

  if (existing) {
    await db
      .update(users)
      .set({ ...profile, clerkId: payload.id, updatedAt: now })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const primary = primaryEmailOf(payload);
  await db.insert(users).values({
    id: payload.externalId ?? payload.id,
    clerkId: payload.id,
    name: profile.name,
    email: primary?.email ?? `${payload.id}@unverified.clerk`,
    emailVerified: primary?.verified ?? false,
    image: profile.image,
    createdAt: now,
    updatedAt: now,
    referralCode: generateReferralCode(),
  });
  return payload.externalId ?? payload.id;
}

type WebhookOutcome = {
  received: boolean;
  action?: "upserted" | "deleted" | "ignored";
  detail?: string;
};

export async function POST(request: Request): Promise<Response> {
  const secret = env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET is not configured");
    return Response.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  let event: z.infer<typeof verifiedEventSchema>;
  try {
    const wh = new Webhook(secret);
    // svix's verify() returns the JSON payload as unknown and throws on any
    // signature/timestamp problem, so parse the verified value with Zod here.
    const verified = wh.verify(rawBody, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
    const parsedEvent = verifiedEventSchema.safeParse(verified);
    if (!parsedEvent.success) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    event = parsedEvent.data;
  } catch (error) {
    console.warn("[clerk-webhook] signature verification failed:", error);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["user.created", "user.updated", "user.deleted"].includes(event.type)) {
    const outcome: WebhookOutcome = { received: true, action: "ignored", detail: event.type };
    return Response.json(outcome);
  }

  // Deactivations (deleted=false) keep the account; hard deletes remove it.
  if (event.type === "user.deleted" && deactivatedSchema.safeParse(event.data).success) {
    const outcome: WebhookOutcome = { received: true, action: "ignored", detail: "deactivation" };
    return Response.json(outcome);
  }

  const userResult = clerkUserSchema.safeParse(event.data);
  if (!userResult.success) {
    return Response.json({ error: "Unrecognized user payload" }, { status: 400 });
  }
  const payload = toUserPayload(userResult.data);

  const db = getDb(env.HYPERDRIVE);

  try {
    if (event.type === "user.deleted") {
      await db.delete(users).where(eq(users.clerkId, payload.id));
      const outcome: WebhookOutcome = { received: true, action: "deleted" };
      return Response.json(outcome);
    }

    const userId = await upsertUser(db, payload);
    const outcome: WebhookOutcome = { received: true, action: "upserted", detail: userId };
    return Response.json(outcome);
  } catch (error) {
    console.error(`[clerk-webhook] ${event.type} handling failed:`, error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
