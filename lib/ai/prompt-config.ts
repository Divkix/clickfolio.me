export const DEFAULT_AI_MODEL = "openai/gpt-6-luna:nitro";

export const MAX_OUTPUT_TOKENS = 32_768;

export const PROVIDER_ROUTING = {
  openrouter: {
    plugins: [{ id: "response-healing" }],
    provider: {
      allow_fallbacks: true,
    },
  },
};

const RESUME_SCHEMA = `{
  "full_name": "",
  "headline": "",
  "summary": "",
  "contact": {
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "website": "",
    "behance": "",
    "dribbble": ""
  },
  "experience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "start_date": "",
      "end_date": "",
      "description": "",
      "highlights": [""]
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "location": "",
      "graduation_date": "",
      "gpa": ""
    }
  ],
  "skills": [
    {
      "category": "",
      "items": [""]
    }
  ],
  "certifications": [
    {
      "name": "",
      "issuer": "",
      "date": "",
      "url": ""
    }
  ],
  "projects": [
    {
      "title": "",
      "description": "",
      "year": "",
      "technologies": [""],
      "url": "",
      "image_url": ""
    }
  ]
}`;

export const RESUME_SCHEMA_PROMPT = `The JSON MUST use these exact snake_case keys and structure:
${RESUME_SCHEMA}

Rules:
- Required fields: full_name, headline, summary, experience.
- contact.email is optional. If contact.email is not found, set it to an empty string.
- Dates: use YYYY-MM when possible. For current roles, OMIT end_date (do not use "Present").
- URLs: return full https:// URLs when known.
- Descriptions: preserve original wording. Do not embellish.
- If bullet points exist, include them in highlights and summarize in description.
- Skills are an array of { category, items }, not an object.
- Extract education, skills, certifications, and projects whenever the resume contains them; use an empty array only for a section it does not contain.
- Do not add fields not in the schema.`;

export function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);

  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}
