import { Effect } from "effect";
import type { UnknownRecord } from "@/lib/types/json";
import { AiOutputInvalid } from "@/lib/parse/failures";
import { parsePartialJson } from "ai";

export function parseJsonWithRepairEffect(
  jsonStr: string,
): Effect.Effect<{ data: UnknownRecord; repaired: boolean }, AiOutputInvalid> {
  const invalid = (cause?: unknown) =>
    new AiOutputInvalid({
      // Length only: the response is resume content, and this message is logged.
      message: `Failed to parse AI response as JSON (${jsonStr.length} chars)`,
      cause,
    });

  return Effect.gen(function* () {
    const result = yield* Effect.try({
      try: () => ({ value: JSON.parse(jsonStr), repaired: false }),
      catch: invalid,
    }).pipe(
      Effect.catchTag("AiOutputInvalid", () =>
        Effect.tryPromise({
          try: () => parsePartialJson(jsonStr),
          catch: invalid,
        }).pipe(Effect.map((result) => ({ value: result.value, repaired: true }))),
      ),
    );

    if (result.value === null || Array.isArray(result.value) || !(result.value instanceof Object)) {
      return yield* invalid();
    }

    // SAFETY: JSON/repair output is a non-null non-array object; AI normalization accepts its JSON fields.
    const data = result.value as UnknownRecord;

    return { data, repaired: result.repaired };
  });
}

export function transformToSchema(data: UnknownRecord): UnknownRecord {
  const result = { ...data };

  if (result.skills && result.skills instanceof Object && !Array.isArray(result.skills)) {
    // SAFETY: object and Array.isArray guard above ensures result.skills is a plain object; Record<string,string[]> is safe for AI skill-category map transformation.
    const skillsObj = result.skills as Record<string, string[]>;
    result.skills = Object.entries(skillsObj).map(([category, items]) => ({
      category,
      items: Array.isArray(items) ? items : [items],
    }));
  }

  if (Array.isArray(result.experience)) {
    // SAFETY: Array.isArray guard above ensures result.experience is an array; UnknownRecord[] is the safe type for mapping AI experience entries.
    result.experience = (result.experience as UnknownRecord[]).map((exp) => {
      if (Array.isArray(exp.description)) {
        return {
          ...exp,
          description: "",
          // SAFETY: Array.isArray guard above ensures exp.description is a string array.
          highlights: exp.description as string[],
        };
      }

      return exp;
    });
  }

  if (Array.isArray(result.projects)) {
    // SAFETY: Array.isArray guard above ensures result.projects is an array; UnknownRecord[] is the safe type for mapping AI project entries.
    result.projects = (result.projects as UnknownRecord[]).map((proj) => {
      const transformed = { ...proj };

      if (Array.isArray(proj.description)) {
        // SAFETY: Array.isArray guard above ensures proj.description is a string array.
        transformed.description = (proj.description as string[]).join(" ");
      }

      if (proj.date && !proj.year) {
        transformed.year = proj.date;
        delete transformed.date;
      }

      return transformed;
    });
  }

  return result;
}
