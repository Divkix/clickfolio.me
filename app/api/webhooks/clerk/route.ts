/**
 * configure it with `wrangler secret put CLERK_WEBHOOK_SECRET` and point a
 * Clerk Dashboard webhook at https://clickfolio.me/api/webhooks/clerk.
 */

import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { PgQueryable } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { user as users } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runRoute } from "@/lib/effect/edges";
import { ClerkFailed, Conflict, InvalidInput, Unauthorized } from "@/lib/effect/failures";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { collectR2KeysForUser } from "@/lib/data/user-r2-keys";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";

export const dynamic = "force-dynamic";

const verifiedEventSchema = z.object({
  type: z.string(),
  data: z.unknown().optional(),
});

const deactivatedSchema = z.object({ deleted: z.literal(false) });

const clerkEmailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
  verification: z.object({ status: z.string().nullish() }).nullish(),
});

const clerkUserSchema = z.object({
  id: z.string(),
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
    verified: primary.verification?.status === "verified",
  };
}

async function findMappedUser(db: PgQueryable, payload: ClerkUserPayload) {
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

async function upsertUser(db: PgQueryable, payload: ClerkUserPayload): Promise<string> {
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

      // Another account owns that address. Keep the old one but stop mailing it: it is
      // no longer the account's verified primary. Acked (2xx) so Svix does not retry.
      log("warn", "[clerk-webhook] primary email already belongs to another account", {
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

    // Preserve the other account's email mapping while acknowledging this delivery.
    log("warn", "[clerk-webhook] primary email already belongs to another account", {
      userId: values.id,
    });
    await db.insert(users).values({
      ...values,
      email: `${payload.id}@unverified.clerk`,
      emailVerified: false,
    });
  }

  return payload.externalId ?? payload.id;
}

type WebhookOutcome = {
  received: boolean;
  action?: "upserted" | "deleted" | "ignored";
  detail?: string;
};

const VERIFY_OPERATION = "clerk.webhook-verify";

/**
 * Checks the Svix signature and timestamp, then parses the verified body. A bad signature is the
 * sender's fault (401); a malformed signing secret or none at all is ours (500).
 */
function verifiedEvent(request: Request) {
  return Effect.gen(function* () {
    const secret = env.CLERK_WEBHOOK_SECRET;

    if (!secret) {
      return yield* Effect.fail(
        new ClerkFailed({
          operation: VERIFY_OPERATION,
          kind: "rejected",
          message: "CLERK_WEBHOOK_SECRET is not configured",
        }),
      );
    }

    const rawBody = yield* Effect.tryPromise({
      try: () => request.text(),
      catch: () => new InvalidInput({ message: "Invalid request body" }),
    });

    const webhook = yield* Effect.try({
      try: () => new Webhook(secret),
      catch: (cause) =>
        new ClerkFailed({
          operation: VERIFY_OPERATION,
          kind: "rejected",
          message: "CLERK_WEBHOOK_SECRET is not a valid Svix secret",
          cause,
        }),
    });

    // verify() throws on any signature/timestamp problem and, since svix 2.2,
    // returns undefined instead of the parsed body — parse the verified raw
    // body here. Parsing the return value breaks every delivery.
    yield* Effect.try({
      try: () =>
        webhook.verify(rawBody, {
          "svix-id": request.headers.get("svix-id") ?? "",
          "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
          "svix-signature": request.headers.get("svix-signature") ?? "",
        }),
      catch: (cause) => {
        log("warn", "[clerk-webhook] signature verification failed:", { ...errorFields(cause) });

        return new Unauthorized({ message: "Unauthorized" });
      },
    });

    const json = yield* Effect.try({
      try: () => JSON.parse(rawBody),
      catch: () => new InvalidInput({ message: "Invalid payload" }),
    });

    const parsedEvent = verifiedEventSchema.safeParse(json);

    if (!parsedEvent.success) {
      return yield* Effect.fail(new InvalidInput({ message: "Invalid payload" }));
    }

    return parsedEvent.data;
  });
}

function handleDelivery(request: Request) {
  return Effect.gen(function* () {
    const event = yield* verifiedEvent(request);

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
      return yield* Effect.fail(new InvalidInput({ message: "Unrecognized user payload" }));
    }

    const payload = toUserPayload(userResult.data);

    if (event.type === "user.deleted") {
      // Start the R2 cleanup before the cascade removes the resume rows the keys
      // come from. A failed start fails the delivery before the delete, so the Svix
      // retry collects the same keys again (R2 deletes are idempotent).
      const mapped = yield* Db.use((db) =>
        db.query("webhook.clerk.find-user", (handle) => findMappedUser(handle, payload)),
      );

      if (mapped) {
        const keys = yield* Db.use((db) =>
          db.query("webhook.clerk.resume-keys", (handle) =>
            collectR2KeysForUser(handle, mapped.id),
          ),
        );

        yield* R2DeleteScheduler.use((scheduler) =>
          scheduler.schedule({ keys, prefix: `users/${mapped.id}/` }),
        );
      }

      // Delete the row that was mapped, which may have matched by external id alone: deleting
      // by Clerk id would leave it behind with its files already swept.
      if (mapped) {
        yield* Db.use((db) =>
          db.query("webhook.clerk.delete-user", (handle) =>
            handle.delete(users).where(eq(users.id, mapped.id)),
          ),
        );
      }

      yield* Effect.sync(() => {
        notifyIndexNowForProfiles([mapped?.handle], { skipDebounce: true });
        revalidatePublicProfilePages([mapped?.handle]);
      });

      const outcome: WebhookOutcome = { received: true, action: "deleted" };

      return Response.json(outcome);
    }

    // A concurrent delivery for the same user can win the insert; Svix retries and then updates.
    const userId = yield* Db.use((db) =>
      db.query("webhook.clerk.upsert-user", (handle) => upsertUser(handle, payload)),
    ).pipe(
      Effect.catchTag("DbConflict", () =>
        Effect.fail(new Conflict({ message: "Conflicting user record" })),
      ),
    );

    const outcome: WebhookOutcome = { received: true, action: "upserted", detail: userId };

    return Response.json(outcome);
  });
}

export function POST(request: Request): Promise<Response> {
  return runRoute(
    request,
    handleDelivery(request),
    Layer.mergeAll(Db.layer(env.HYPERDRIVE), R2DeleteScheduler.layer(env)),
  );
}
