import Replicate from 'replicate'
import { z } from 'zod'
import type { ResumeContent } from '@/lib/types/database'

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

// Zod schemas for runtime validation
const ContactSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  github: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
})

const ExperienceItemSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional().nullable(),
  start_date: z.string(),
  end_date: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  highlights: z.array(z.string()).optional().nullable(),
})

const EducationItemSchema = z.object({
  degree: z.string(),
  institution: z.string(),
  location: z.string().optional(),
  graduation_date: z.string().optional(),
  gpa: z.string().optional(),
})

const SkillCategorySchema = z.object({
  category: z.string(),
  items: z.array(z.string()),
})

const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  date: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
})

const ProjectSchema = z.object({
  title: z.string(),
  description: z.string(),
  year: z.string().optional().nullable(),
  technologies: z.array(z.string()).optional().nullable(),
  url: z.string().optional().nullable(),
})

const ResumeContentSchema = z.object({
  full_name: z.string(),
  headline: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  contact: ContactSchema,
  experience: z.array(ExperienceItemSchema),
  education: z.array(EducationItemSchema).optional().nullable(),
  skills: z.array(SkillCategorySchema).optional().nullable(),
  certifications: z.array(CertificationSchema).optional().nullable(),
  projects: z.array(ProjectSchema).optional().nullable(),
})

// JSON schema for Replicate model
const RESUME_EXTRACTION_SCHEMA = {
  type: 'object',
  required: ['full_name', 'headline', 'summary', 'contact', 'experience'],
  properties: {
    full_name: {
      type: 'string',
      description: 'Full name of the person',
    },
    headline: {
      type: 'string',
      description: 'A concise 10-word professional headline/title',
      maxLength: 100,
    },
    summary: {
      type: 'string',
      description: 'Professional summary or objective statement',
      maxLength: 500,
    },
    contact: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        location: { type: 'string', description: 'City, State format preferred' },
        linkedin: { type: 'string', format: 'uri' },
        github: { type: 'string', format: 'uri' },
        website: { type: 'string', format: 'uri' },
      },
    },
    experience: {
      type: 'array',
      description: 'Work experience in reverse chronological order',
      items: {
        type: 'object',
        required: ['title', 'company', 'start_date', 'description'],
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          start_date: { type: 'string', description: 'Format: YYYY-MM or Month YYYY' },
          end_date: {
            type: 'string',
            description: 'Format: YYYY-MM or Month YYYY. Omit for current role.',
          },
          description: { type: 'string' },
          highlights: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key achievements or responsibilities',
          },
        },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        required: ['degree', 'institution'],
        properties: {
          degree: { type: 'string' },
          institution: { type: 'string' },
          location: { type: 'string' },
          graduation_date: { type: 'string' },
          gpa: { type: 'string' },
        },
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'items'],
        properties: {
          category: { type: 'string', description: 'Skill category (e.g., Languages, Frameworks)' },
          items: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'issuer'],
        properties: {
          name: { type: 'string' },
          issuer: { type: 'string' },
          date: { type: 'string' },
          url: { type: 'string', format: 'uri' },
        },
      },
    },
    projects: {
      type: 'array',
      description: 'Personal projects, side work, portfolio pieces, or notable work mentioned in the resume',
      items: {
        type: 'object',
        required: ['title', 'description'],
        properties: {
          title: {
            type: 'string',
            description: 'Project name or title',
          },
          description: {
            type: 'string',
            maxLength: 200,
            description: 'Brief description of the project and its impact',
          },
          year: {
            type: 'string',
            description: 'Year completed or date range',
          },
          technologies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Technologies, frameworks, or tools used',
          },
          url: {
            type: 'string',
            description: 'Project URL or demo link if available',
          },
        },
      },
    },
  },
}

export interface ParseResumeResult {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'aborted'
}

export interface ParseStatusResult {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'aborted'
  output?: {
    extraction_schema_json?: string
    [key: string]: unknown
  }
  error?: string
  logs?: string
}

/**
 * Trigger AI parsing of a resume PDF
 * @param presignedUrl - R2 presigned GET URL for the PDF file
 * @returns Prediction object with ID and initial status
 */
export async function parseResume(presignedUrl: string): Promise<ParseResumeResult> {
  try {
    const prediction = await replicate.predictions.create({
      model: 'datalab-to/marker',
      input: {
        file: presignedUrl,
        use_llm: true,
        page_schema: JSON.stringify(RESUME_EXTRACTION_SCHEMA),
      },
    })

    return {
      id: prediction.id,
      status: prediction.status as ParseResumeResult['status'],
    }
  } catch (error) {
    console.error('Failed to start Replicate parsing:', error)
    throw new Error(
      `Replicate API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Check status of a Replicate parsing job
 * @param predictionId - Replicate prediction ID
 * @returns Status result with output if completed
 */
export async function getParseStatus(predictionId: string): Promise<ParseStatusResult> {
  try {
    const prediction = await replicate.predictions.get(predictionId)

    return {
      id: prediction.id,
      status: prediction.status as ParseStatusResult['status'],
      output: prediction.output as ParseStatusResult['output'],
      error: prediction.error ? String(prediction.error) : undefined,
      logs: prediction.logs,
    }
  } catch (error) {
    console.error('Failed to get Replicate status:', error)
    throw new Error(
      `Replicate API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Sanitize URL strings - add https:// if missing, return undefined if invalid
 */
function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url || url === '') return undefined

  // Try to parse as-is
  try {
    new URL(url)
    return url
  } catch {
    // Try adding https:// prefix
    try {
      new URL(`https://${url}`)
      return `https://${url}`
    } catch {
      // Invalid URL even with prefix - return undefined
      return undefined
    }
  }
}

/**
 * Normalize and validate Replicate output into ResumeContent
 * @param extractionJson - JSON string from Replicate's extraction_schema_json
 * @returns Validated and normalized ResumeContent
 */
export function normalizeResumeData(extractionJson: string): ResumeContent {
  let rawData: unknown

  // Parse JSON string
  try {
    rawData = JSON.parse(extractionJson)
  } catch (error) {
    throw new Error(`Invalid JSON from Replicate: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Validate against schema
  const validationResult = ResumeContentSchema.safeParse(rawData)

  if (!validationResult.success) {
    console.error('Validation errors:', validationResult.error.issues)
    throw new Error(`Invalid resume data structure: ${validationResult.error.issues[0]?.message || 'Validation failed'}`)
  }

  const data = validationResult.data

  // Apply defaults for nullable fields and sanitize URLs
  const normalized: ResumeContent = {
    full_name: data.full_name,
    headline: data.headline ?? '',
    summary: data.summary ?? '',
    contact: {
      email: data.contact.email,
      phone: data.contact.phone ?? undefined,
      location: data.contact.location ?? undefined,
      linkedin: sanitizeUrl(data.contact.linkedin),
      github: sanitizeUrl(data.contact.github),
      website: sanitizeUrl(data.contact.website),
    },
    experience: data.experience.map((exp) => ({
      title: exp.title,
      company: exp.company,
      location: exp.location ?? undefined,
      start_date: exp.start_date,
      end_date: exp.end_date ?? undefined,
      description: exp.description ?? '',
      highlights: exp.highlights ?? undefined,
    })),
    education: data.education ?? undefined,
    skills: data.skills ?? undefined,
    certifications: data.certifications?.map((cert) => ({
      name: cert.name,
      issuer: cert.issuer,
      date: cert.date ?? undefined,
      url: sanitizeUrl(cert.url),
    })) ?? undefined,
    projects: data.projects?.map((project) => ({
      title: project.title,
      description: project.description,
      year: project.year ?? undefined,
      technologies: project.technologies ?? undefined,
      url: sanitizeUrl(project.url),
    })) ?? undefined,
  }

  // Normalize: Truncate summary to 500 chars
  if (normalized.summary && normalized.summary.length > 500) {
    normalized.summary = normalized.summary.substring(0, 497) + '...'
  }

  // Normalize: Limit experience to top 5 items
  if (normalized.experience.length > 5) {
    normalized.experience = normalized.experience.slice(0, 5)
  }

  return normalized
}
