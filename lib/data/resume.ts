import { env } from "cloudflare:workers";
import { cache } from "react";
import { loadPublicResume, type PublicResume } from "@/lib/data/public-resume";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";

/**
 * Page edge for `/@handle`: `generateMetadata` and the page share one load per request through
 * React's `cache()`, since vinext resolves the head inside the page's Flight render. A database
 * failure throws to the error boundary (and is never cached by the edge); only a missing profile
 * returns `null`, for the caller to turn into `notFound()`.
 */
export const getResume = cache((handle: string): Promise<PublicResume | null> =>
  runPage(loadPublicResume(handle), Db.layer(env.HYPERDRIVE)),
);
