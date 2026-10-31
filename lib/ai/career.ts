import { Effect } from "effect";
import { APICallError } from "ai";
import { AiOutputInvalid, AiTimedOut } from "@/lib/parse/failures";
import type { AiProviderFailed, AiProviderRejected } from "@/lib/parse/failures";
import { aiProviderFailure } from "./ai-parser";
import { z } from "zod";
import { ROLES, USER_ROLES, type UserRole } from "@/lib/config/roles";
import type { ResumeContent } from "@/lib/types/database";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";
import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import type { AiEnvVars } from "./ai-parser";

// Jev (TypeSafe System One model) via OpenRouter's System One API, proxied by the same
// AI Gateway as the parser (BYOK). Typed answers only: it cannot return an unlisted level.
const JEV_MODEL = "~typesafe/jev-latest";

export type CareerProfile = { role: UserRole; isFreelance: boolean };

const jevResponseSchema = z.object({
  answers: z.object({
    is_resume: z.object({ noul: z.number() }),
    level: z.object({ choice: z.enum(USER_ROLES) }),
    freelance: z.object({ noul: z.number() }),
  }),
});

/**
 * Classifies career level and freelance status from parsed resume content.
 * Returns null for missing configuration or a non-resume. Failures remain typed:
 * the Workflow owns retries and the best-effort fallback after they are exhausted.
 */
export function classifyCareerEffect(
  content: ResumeContent,
  env: Partial<AiEnvVars>,
): Effect.Effect<
  CareerProfile | null,
  AiProviderFailed | AiProviderRejected | AiTimedOut | AiOutputInvalid
> {
  const { CF_AI_GATEWAY_ACCOUNT_ID, CF_AI_GATEWAY_ID, CF_AIG_AUTH_TOKEN } = env;

  if (!CF_AI_GATEWAY_ACCOUNT_ID || !CF_AI_GATEWAY_ID || !CF_AIG_AUTH_TOKEN)
    return Effect.succeed(null);

  // No roles or degrees means nothing to classify: the parser fills a generic summary even for
  // blog posts and company pages, which Jev would otherwise accept as a resume.
  if (content.experience.length === 0 && !content.education?.length) return Effect.succeed(null);

  const today = new Date().toISOString().slice(0, 10);

  return Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(
          `https://gateway.ai.cloudflare.com/v1/${CF_AI_GATEWAY_ACCOUNT_ID}/${CF_AI_GATEWAY_ID}/openrouter/systemone`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "cf-aig-authorization": `Bearer ${CF_AIG_AUTH_TOKEN}`,
            },
            signal,
            body: JSON.stringify({
              model: JEV_MODEL,
              state: {
                today,
                headline: content.headline,
                summary: content.summary,
                experience: content.experience.map((e) => ({
                  title: e.title,
                  company: e.company,
                  start_date: e.start_date,
                  end_date: e.end_date,
                })),
                education: content.education?.map((d) => ({
                  degree: d.degree,
                  institution: d.institution,
                  graduation_date: d.graduation_date,
                })),
              },
              questions: {
                is_resume: {
                  type: "noul",
                  instructions:
                    "Is this a person's resume or professional profile (not a blog post, company page, or other document)?",
                },
                level: {
                  type: "choice",
                  instructions: `Today is ${today}. Classify this person's CURRENT career level. Count only full-time work after graduation; internships, working-student, tutoring, teaching-assistant and campus roles don't count as years.`,
                  criteria: Object.fromEntries(USER_ROLES.map((r) => [r, ROLES[r].criteria])),
                },
                freelance: {
                  type: "noul",
                  instructions:
                    "Is this person's current work primarily freelance, contract, consulting, or self-employed rather than a salaried job?",
                },
              },
            }),
          },
        );

        if (!response.ok)
          throw new APICallError({
            message: `Jev HTTP ${response.status}`,
            url: response.url,
            statusCode: response.status,
            requestBodyValues: undefined,
          });

        return response.json();
      },
      catch: aiProviderFailure,
    });

    const parsed = jevResponseSchema.safeParse(body);

    if (!parsed.success)
      return yield* new AiOutputInvalid({ message: parsed.error.message, cause: parsed.error });
    const { answers } = parsed.data;

    if (answers.is_resume.noul < 0.5) return null;

    return { role: answers.level.choice, isFreelance: answers.freelance.noul >= 0.5 };
  }).pipe(
    Effect.timeoutOrElse({
      duration: TIMEOUT_MS.aiCareer,
      orElse: () => Effect.fail(new AiTimedOut({ message: "Career classification timed out" })),
    }),
    Effect.tapError((error) =>
      Effect.sync(() => log("warn", "career classification failed", errorFields(error))),
    ),
  );
}
