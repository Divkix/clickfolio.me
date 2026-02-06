import { z } from "zod";

/**
 * Contact information schema
 */
export const contactSchema = z.object({
  email: z.string().describe("Email address"),
  phone: z.string().optional().describe("Phone number"),
  location: z.string().optional().describe("City, State format preferred"),
  linkedin: z
    .string()
    .optional()
    .describe(
      "Full LinkedIn URL. Must start with https://linkedin.com/in/ or https://www.linkedin.com/in/",
    ),
  github: z.string().optional().describe("Full GitHub URL. Must start with https://github.com/"),
  website: z.string().optional().describe("Full website URL. Must start with https:// or http://"),
  behance: z.string().optional().describe("Full Behance URL. Must start with https://behance.net/"),
  dribbble: z
    .string()
    .optional()
    .describe("Full Dribbble URL. Must start with https://dribbble.com/"),
});

/**
 * Work experience schema
 */
export const experienceSchema = z.object({
  title: z.string().describe("Job title"),
  company: z.string().describe("Company name"),
  location: z.string().optional().describe("Job location"),
  start_date: z.string().describe("Format: YYYY-MM or Month YYYY"),
  end_date: z.string().optional().describe("Format: YYYY-MM or Month YYYY. Omit for current role."),
  description: z.string().describe("Role description (2-4 sentences, max 500 characters)"),
  highlights: z.array(z.string()).optional().describe("Key achievements or responsibilities"),
});

/**
 * Education schema
 */
export const educationSchema = z.object({
  degree: z.string().describe("Degree name"),
  institution: z.string().describe("University or school name. Always include this field."),
  location: z.string().optional().describe("School location"),
  graduation_date: z.string().optional().describe("Graduation date"),
  gpa: z.string().optional().describe("GPA if applicable"),
});

/**
 * Skills schema
 */
export const skillSchema = z.object({
  category: z.string().describe("Skill category (e.g., Languages, Frameworks)"),
  items: z
    .array(z.string())
    .min(1)
    .describe("List of skills in this category. Must have at least one item."),
});

/**
 * Certification schema
 */
export const certificationSchema = z.object({
  name: z.string().describe("Certification name"),
  issuer: z
    .string()
    .describe("Organization that issued the certification. Always include this field."),
  date: z.string().optional().describe("Date obtained"),
  url: z.string().optional().describe("Certification URL. Must start with https:// or http://"),
});

/**
 * Project schema
 */
export const projectSchema = z.object({
  title: z.string().describe("Project name or title"),
  description: z
    .string()
    .describe(
      "Brief description of the project and its impact (1-2 sentences, max 200 characters)",
    ),
  year: z.string().optional().describe("Year completed or date range"),
  technologies: z.array(z.string()).optional().describe("Technologies, frameworks, or tools used"),
  url: z
    .string()
    .optional()
    .describe("Project URL or demo link. Must start with https:// or http://"),
  image_url: z
    .string()
    .optional()
    .describe("URL to project screenshot or thumbnail image. Must start with https:// or http://"),
});

/**
 * Full resume schema for AI extraction and validation.
 * Used both for structured AI output (Output.object()) and downstream validation.
 * The .describe() annotations serve double duty: they document field expectations
 * and become JSON Schema description fields that guide AI structured output.
 */
export const resumeSchema = z.object({
  full_name: z.string().describe("Full name of the person"),
  headline: z
    .string()
    .describe("A concise professional headline/title (max 10 words, under 100 characters)"),
  summary: z
    .string()
    .describe("Professional summary or objective statement (2-4 sentences, max 500 characters)"),
  contact: contactSchema.describe("Contact information"),
  experience: z
    .array(experienceSchema)
    .max(15)
    .describe("Work experience in reverse chronological order"),
  education: z
    .array(educationSchema)
    .max(15)
    .describe("Education history. Return empty array [] if absent."),
  skills: z
    .array(skillSchema)
    .max(25)
    .describe("Skills grouped by category. Return empty array [] if absent."),
  certifications: z
    .array(certificationSchema)
    .max(25)
    .describe("Professional certifications. Return empty array [] if absent."),
  projects: z
    .array(projectSchema)
    .max(15)
    .describe("Personal projects, side work, portfolio pieces. Return empty array [] if absent."),
});

/**
 * TypeScript types derived from schema
 */
export type ResumeSchema = z.infer<typeof resumeSchema>;
