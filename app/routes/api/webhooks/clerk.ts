import { createFileRoute } from "@tanstack/react-router";
/**
 * configure it with `wrangler secret put CLERK_WEBHOOK_SECRET` and point a
 * Clerk Dashboard webhook at https://clickfolio.me/api/webhooks/clerk.
 */

import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { clerkUserSchema, findMappedUser, toUserPayload, upsertUser } from "@/lib/auth/clerk-user";
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

const verifiedEventSchema = z.object({
  type: z.string(),
  data: z.unknown().optional(),
});

const deactivatedSchema = z.object({ deleted: z.literal(false) });

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

    // JIT provisioning and concurrent webhook deliveries share the same idempotent mapping.
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

export const Route = createFileRoute("/api/webhooks/clerk")({
  server: {
    handlers: {
      POST: ({ request }) => {
        return runRoute(
          request,
          handleDelivery(request),
          Layer.mergeAll(Db.layer(env.HYPERDRIVE), R2DeleteScheduler.layer(env)),
        );
      },
    },
  },
});
