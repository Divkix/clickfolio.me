import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "@/lib/auth";

/**
 * Cached session helper for React Server Components
 * Deduplicates auth.api.getSession() calls within a single request
 *
 * React's cache() ensures that multiple calls to getServerSession()
 * within the same request lifecycle return the same session object
 * without making duplicate auth API calls.
 */
export const getServerSession = cache(async () => {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
});
