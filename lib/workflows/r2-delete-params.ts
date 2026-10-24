import { z } from "zod";

// A prefix sweep deletes everything under it, so only `<root>/<owner>/` shapes pass: "" and
// "users/" would otherwise empty the bucket or a whole tree. Callers send `users/{userId}/`.
export const r2DeletePrefixSchema = z.string().regex(/^[^/]+\/[^/]+\/$/);

/** What R2DeleteWorkflow accepts: checked when a deletion is scheduled and again when it runs. */
export const r2DeleteParamsSchema = z.object({
  keys: z.array(z.string().min(1)),
  /** Also delete every object under this prefix (listed inside the workflow). */
  prefix: r2DeletePrefixSchema.optional(),
});

export type R2DeleteParams = z.infer<typeof r2DeleteParamsSchema>;
