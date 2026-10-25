// zod/mini: the route's validateSearch ships this in the entry chunk, and full zod doesn't tree-shake.
import * as z from "zod/mini";
import { isUserRole } from "@/lib/config/roles";

// A malformed page falls back to page one; the router then redirects to the canonical URL.
export const exploreSearchSchema = z.object({
  page: z.catch(
    z._default(
      z.coerce.number().check(z.int(), z.minimum(1), z.maximum(Number.MAX_SAFE_INTEGER)),
      1,
    ),
    1,
  ),
  role: z.pipe(
    z.catch(z.optional(z.string()), ""),
    z.transform((value) => (isUserRole(value) || value === "freelance" ? value : "")),
  ),
});

export type ExploreSearch = z.output<typeof exploreSearchSchema>;
