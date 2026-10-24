import { Effect } from "effect";
import { z } from "zod";
import { DbFailed } from "@/lib/effect/failures";
import type { ResumeContent } from "@/lib/types/database";

const listOfObjects = z.array(z.looseObject({})).nullish();

/**
 * The stored structure a render can index: `contact` is an object (or absent), each list member is
 * an array (or absent), and a skill group carries its `items` array. `contact` and `experience`
 * stay nullish because older rows carry null and some renders show those rows today (`?? []`,
 * `?.`) — rejecting them would turn a working page into an error. The consumers that dereference
 * them without a guard guard themselves (`getProfileSuggestions`). Not `resumeContentSchema`: that
 * one sanitizes (transforms) and enforces write-time limits, so running it over stored rows would
 * change what renders and reject rows saved under older rules. A value that passes is used as
 * read, never replaced by the parsed copy.
 */
const renderableContentSchema = z.looseObject({
  contact: z.looseObject({}).nullish(),
  experience: listOfObjects,
  education: listOfObjects,
  certifications: listOfObjects,
  projects: listOfObjects,
  skills: z.array(z.looseObject({ items: z.array(z.unknown()) })).nullish(),
});

/**
 * `site_data.content` read back from jsonb (typed `ResumeContent`, which the column cannot enforce), checked before it feeds a render. A malformed row
 * fails as an `invalid-response` instead of crashing a template halfway through the page.
 * `operation` names the read; the message carries paths only, never resume text.
 */
export function readStoredContent(
  content: ResumeContent,
  operation: string,
): Effect.Effect<ResumeContent, DbFailed> {
  const parsed = renderableContentSchema.safeParse(content);

  if (!parsed.success) {
    const paths = parsed.error.issues
      .slice(0, 3)
      .map((issue) => issue.path.join(".") || "(root)")
      .join(", ");

    return Effect.fail(
      new DbFailed({
        operation,
        kind: "invalid-response",
        message: `Stored resume content has an unexpected shape at ${paths}`,
        cause: parsed.error,
      }),
    );
  }

  return Effect.succeed(content);
}
