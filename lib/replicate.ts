import Replicate from 'replicate'
import { z } from 'zod'
import type { ResumeContent } from '@/lib/types/database'

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

// Zod schemas for runtime validation
const ContactSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin: z.string().url().optional().or(z.literal('')),
  github: z.string().url().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
})

const ExperienceItemSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  start_date: z.string(),
  end_date: z.string().optional(),
  description: z.string(),
  highlights: z.array(z.string()).optional(),
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
  date: z.string().optional(),
  url: z.string().url().optional().or(z.literal('')),
})

const ResumeContentSchema = z.object({
  full_name: z.string(),
  headline: z.string(),
  summary: z.string(),
  contact: ContactSchema,
  experience: z.array(ExperienceItemSchema),
  education: z.array(EducationItemSchema).optional(),
  skills: z.array(SkillCategorySchema).optional(),
  certifications: z.array(CertificationSchema).optional(),
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
      version: 'datalab-to/marker:latest', // Use latest version
      input: {
        file: presignedUrl,
        use_llm: true,
        page_schema: RESUME_EXTRACTION_SCHEMA,
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

  // Normalize: Truncate summary to 500 chars
  if (data.summary.length > 500) {
    data.summary = data.summary.substring(0, 497) + '...'
  }

  // Normalize: Limit experience to top 5 items
  if (data.experience.length > 5) {
    data.experience = data.experience.slice(0, 5)
  }

  // Clean up empty URL strings
  if (data.contact.linkedin === '') delete data.contact.linkedin
  if (data.contact.github === '') delete data.contact.github
  if (data.contact.website === '') delete data.contact.website

  if (data.certifications) {
    data.certifications = data.certifications.map((cert) => {
      if (cert.url === '') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { url: _url, ...rest } = cert
        return rest
      }
      return cert
    })
  }

  return data
}
