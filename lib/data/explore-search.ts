import { z } from "zod";
import { isUserRole } from "@/lib/config/roles";

// A malformed page falls back to page one; the router then redirects to the canonical URL.
export const exploreSearchSchema = z.object({
  page: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1).catch(1),
  role: z
    .string()
    .optional()
    .catch("")
    .transform((value) => (isUserRole(value) || value === "freelance" ? value : "")),
});

export type ExploreSearch = z.output<typeof exploreSearchSchema>;
