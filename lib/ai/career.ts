import { z } from "zod";
import { ROLES, USER_ROLES, type UserRole } from "@/lib/config/roles";
import type { ResumeContent } from "@/lib/types/database";
import { log } from "@/lib/utils/log";
import type { AiEnvVars } from "./ai-parser";

// Jev (TypeSafe System One model) via OpenRouter's System One API, proxied by the same
// AI Gateway as the parser (BYOK). Typed answers only: it cannot return an unlisted level.
const JEV_MODEL = "~typesafe/jev-latest";

const TIMEOUT_MS = 10_000;

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
 * Best-effort: returns null when the document isn't a resume or Jev is unavailable,
 * so callers leave the user's current values untouched.
 */
export async function classifyCareer(
  content: ResumeContent,
  env: Partial<AiEnvVars>,
): Promise<CareerProfile | null> {
  const { CF_AI_GATEWAY_ACCOUNT_ID, CF_AI_GATEWAY_ID, CF_AIG_AUTH_TOKEN } = env;

  if (!CF_AI_GATEWAY_ACCOUNT_ID || !CF_AI_GATEWAY_ID || !CF_AIG_AUTH_TOKEN) return null;

  // No roles or degrees means nothing to classify: the parser fills a generic summary even for
  // blog posts and company pages, which Jev would otherwise accept as a resume.
  if (content.experience.length === 0 && !content.education?.length) return null;

  const today = new Date().toISOString().slice(0, 10);

  try {
    const response = await fetch(
      `https://gateway.ai.cloudflare.com/v1/${CF_AI_GATEWAY_ACCOUNT_ID}/${CF_AI_GATEWAY_ID}/openrouter/systemone`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-aig-authorization": `Bearer ${CF_AIG_AUTH_TOKEN}`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
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

    if (!response.ok) throw new Error(`Jev HTTP ${response.status}`);

    const { answers } = jevResponseSchema.parse(await response.json());

    if (answers.is_resume.noul < 0.5) return null;

    return { role: answers.level.choice, isFreelance: answers.freelance.noul >= 0.5 };
  } catch (error) {
    log("warn", "career classification failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}
