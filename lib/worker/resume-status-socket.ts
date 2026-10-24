import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { resolveAuth } from "../auth/clerk";
import { resumes, user as userTable } from "../db/schema";
import { Db } from "../effect/db";
import { runRoute } from "../effect/edges";
import { externalCall } from "../effect/external";
import { DurableObjectFailed } from "../effect/failures";
import { appLayer } from "../effect/layers";
import { TIMEOUT_MS } from "../effect/timeouts";

// WebSocket upgrade for /ws/resume-status, answered by the Worker itself because Next.js route
// handlers have no WebSocket API. The bodies stay plain text: the browser only reads the status of
// a failed upgrade. A Clerk or database outage is a typed failure and answers 503 through `runRoute`.

function plain(body: string, status: number): Response {
  return new Response(body, { status });
}

/**
 * Hands the upgrade to the resume's status Durable Object. One attempt, never retried: the object
 * answers 101 at once, so a timeout means it is unreachable, not slow.
 */
function forwardToStatusObject(
  request: Request,
  namespace: NonNullable<CloudflareEnv["CLICKFOLIO_STATUS_DO"]>,
  resumeId: string,
  userId: string,
) {
  // Headers.set (not object spread) guarantees a client-supplied x-authenticated-user-id is
  // overwritten: object keys are case-sensitive, header names are not, so spread would leave
  // both values behind.
  const headers = new Headers(request.headers);
  headers.set("X-Authenticated-User-Id", userId);
  const forwarded = new Request(request, { headers });

  return externalCall({
    operation: "status.upgrade",
    timeoutMs: TIMEOUT_MS.durableObject,
    run: () => namespace.get(namespace.idFromName(resumeId)).fetch(forwarded),
    fail: (details) => new DurableObjectFailed(details),
  });
}

/** Authenticates the caller, checks they own the resume, then forwards the upgrade. */
function resumeStatusSocket(request: Request, env: CloudflareEnv) {
  return Effect.gen(function* () {
    const resumeId = new URL(request.url).searchParams.get("resume_id");

    if (!resumeId) return plain("Missing resume_id query parameter", 400);

    const auth = yield* resolveAuth(request);

    if (!auth) return plain("Unauthorized: Invalid session", 401);

    const owner = yield* Db.use((db) =>
      db.query("ws.owner", (handle) =>
        handle.query.user.findFirst({
          where: eq(userTable.clerkId, auth.clerkId),
          columns: { id: true },
        }),
      ),
    );

    if (!owner) return plain("Unauthorized: Unknown user", 401);

    const resume = yield* Db.use((db) =>
      db.query("ws.resume", (handle) =>
        handle.query.resumes.findFirst({
          where: eq(resumes.id, resumeId),
          columns: { id: true, userId: true },
        }),
      ),
    );

    if (!resume) return plain("Resume not found", 404);

    if (resume.userId !== owner.id) return plain("Forbidden: You don't own this resume", 403);

    if (!env.CLICKFOLIO_STATUS_DO) return plain("WebSocket not available", 503);

    return yield* forwardToStatusObject(request, env.CLICKFOLIO_STATUS_DO, resumeId, owner.id);
  });
}

export function handleResumeStatusSocket(request: Request, env: CloudflareEnv): Promise<Response> {
  return runRoute(request, resumeStatusSocket(request, env), appLayer(env));
}
