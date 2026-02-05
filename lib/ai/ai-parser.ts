import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { resumeSchema } from "./schema";

const DEFAULT_AI_MODEL = "openai/gpt-oss-120b:nitro";

/**
 * System prompt for resume extraction
 */
const SYSTEM_PROMPT = `You are an expert resume parser. Extract information from resumes into structured JSON.

## REQUIRED FIELDS (must ALWAYS be present)
- full_name: Person's full name. If unclear, use the most prominent name at the top.
- headline: Professional title/role (e.g., "Senior Software Engineer"). Generate from most recent job title if not explicit.
- summary: 2-4 sentence professional summary. If no explicit summary exists, synthesize one from the person's experience and skills.
- contact.email: Primary email address. Required.
- experience: Work history array. Include ALL positions found.

## EXTRACTION RULES
1. Dates: YYYY-MM format (e.g., 2023-08). Use "Present" for current roles.
2. URLs: Full URLs with https:// prefix. Validate format before including.
3. Locations: "City, State" or "City, Country" format.
4. Descriptions: Preserve original wording. Do not embellish.

## FIELD-SPECIFIC GUIDANCE
- summary: CRITICAL - Never leave empty. If no explicit summary section exists, write one based on the person's experience, skills, and career trajectory.
- headline: If not stated, derive from most recent job title or primary skill area.
- skills: Group into logical categories (Languages, Frameworks, Tools, etc.)
- certifications: Include courses, licenses, awards, honors, competitions.
- projects: Extract technologies into the technologies array.

## OUTPUT RULES
- Return ONLY valid JSON matching the schema
- Never omit sections if data exists in the resume
- Use empty arrays [] only for truly absent sections
- Do not add fields not in the schema`;

export interface AiParseResult {
  success: boolean;
  data: unknown;
  error?: string;
}

/**
 * Environment variables for AI provider configuration
 * These extend the base CloudflareEnv with AI-specific secrets
 */
interface AiEnvVars {
  CF_AI_GATEWAY_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
  CF_AIG_AUTH_TOKEN?: string;
  OPENROUTER_API_KEY?: string;
  AI_MODEL?: string;
}

/**
 * Create AI provider based on environment configuration
 * Prefers Cloudflare AI Gateway if configured, falls back to direct OpenRouter
 */
export function createAiProvider(env: Partial<CloudflareEnv> & AiEnvVars) {
  // Check for Cloudflare AI Gateway configuration
  const gatewayAccountId = env.CF_AI_GATEWAY_ACCOUNT_ID;
  const gatewayId = env.CF_AI_GATEWAY_ID;
  const gatewayAuthToken = env.CF_AIG_AUTH_TOKEN;

  if (gatewayAccountId && gatewayId && gatewayAuthToken) {
    return createOpenAICompatible({
      name: "cf-ai-gateway",
      baseURL: `https://gateway.ai.cloudflare.com/v1/${gatewayAccountId}/${gatewayId}/openrouter`,
      headers: {
        "cf-aig-authorization": `Bearer ${gatewayAuthToken}`,
      },
    });
  }

  // Fallback to direct OpenRouter
  const openrouterApiKey = env.OPENROUTER_API_KEY;
  if (!openrouterApiKey) {
    throw new Error("Neither Cloudflare AI Gateway nor OPENROUTER_API_KEY configured");
  }

  return createOpenAICompatible({
    name: "openrouter",
    apiKey: openrouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

/**
 * Extract JSON from AI response text
 * Handles responses that may have markdown code blocks or extra text
 */
function extractJson(text: string): string {
  // Try to find JSON in markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Find the first { and last } to extract JSON object
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

/**
 * Transform AI response to match our schema
 * Handles common mismatches like skills as object vs array
 */
function transformToSchema(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  // Transform skills from object format to array format
  // AI sometimes returns: { "Design & CAD": ["skill1", "skill2"] }
  // We need: [{ category: "Design & CAD", items: ["skill1", "skill2"] }]
  if (result.skills && typeof result.skills === "object" && !Array.isArray(result.skills)) {
    const skillsObj = result.skills as Record<string, string[]>;
    result.skills = Object.entries(skillsObj).map(([category, items]) => ({
      category,
      items: Array.isArray(items) ? items : [items],
    }));
  }

  // Transform experience descriptions from array to string
  if (Array.isArray(result.experience)) {
    result.experience = (result.experience as Record<string, unknown>[]).map((exp) => {
      if (Array.isArray(exp.description)) {
        return {
          ...exp,
          description: (exp.description as string[]).join(" "),
          highlights: exp.description as string[],
        };
      }
      return exp;
    });
  }

  // Transform project descriptions from array to string
  if (Array.isArray(result.projects)) {
    result.projects = (result.projects as Record<string, unknown>[]).map((proj) => {
      const transformed = { ...proj };
      if (Array.isArray(proj.description)) {
        transformed.description = (proj.description as string[]).join(" ");
      }
      // Rename 'date' to 'year' if present
      if (proj.date && !proj.year) {
        transformed.year = proj.date;
        delete transformed.date;
      }
      return transformed;
    });
  }

  return result;
}

/**
 * Parse resume text using AI
 * Uses text generation and manual JSON parsing for maximum model compatibility
 */
export async function parseWithAi(
  text: string,
  env: Partial<CloudflareEnv> & AiEnvVars,
  model?: string,
): Promise<AiParseResult> {
  try {
    const provider = createAiProvider(env);
    const modelId = model || env.AI_MODEL || DEFAULT_AI_MODEL;

    const { text: responseText } = await generateText({
      model: provider(modelId),
      system: SYSTEM_PROMPT,
      prompt: text,
      temperature: 0,
    });

    // Extract and parse JSON from response
    const jsonStr = extractJson(responseText);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return {
        success: false,
        data: null,
        error: `Failed to parse AI response as JSON: ${jsonStr.slice(0, 200)}...`,
      };
    }

    // Transform to match our schema
    const transformed = transformToSchema(parsed);

    // Validate against schema
    const validation = resumeSchema.safeParse(transformed);
    if (!validation.success) {
      // Log validation errors but still return the transformed data
      // The transform pipeline will handle additional sanitization
      console.warn("Schema validation warnings:", validation.error.issues);
    }

    return { success: true, data: validation.success ? validation.data : transformed };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "AI parsing failed",
    };
  }
}

export { SYSTEM_PROMPT };
