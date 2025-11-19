import { z } from 'zod'
import {
  sanitizeText,
  sanitizeUrl,
  sanitizeEmail,
  sanitizePhone,
  containsXssPattern,
} from '@/lib/utils/sanitization'

/**
 * Custom Zod refinement for XSS detection
 */
const noXssPattern = (value: string) => {
  if (containsXssPattern(value)) {
    return false
  }
  return true
}

/**
 * Contact information schema
 * Email is required, all other fields are optional
 * Includes sanitization and XSS prevention
 */
export const contactSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email({ message: 'Invalid email address' })
    .max(255, 'Email is too long')
    .transform(sanitizeEmail),
  phone: z
    .string()
    .trim()
    .max(50, 'Phone number is too long')
    .transform(sanitizePhone)
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .trim()
    .max(255, 'Location is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' })
    .transform(sanitizeText)
    .optional()
    .or(z.literal('')),
  linkedin: z
    .string()
    .trim()
    .url({ message: 'Invalid LinkedIn URL' })
    .max(500, 'LinkedIn URL is too long')
    .transform(sanitizeUrl)
    .optional()
    .or(z.literal('')),
  github: z
    .string()
    .trim()
    .url({ message: 'Invalid GitHub URL' })
    .max(500, 'GitHub URL is too long')
    .transform(sanitizeUrl)
    .optional()
    .or(z.literal('')),
  website: z
    .string()
    .trim()
    .url({ message: 'Invalid website URL' })
    .max(500, 'Website URL is too long')
    .transform(sanitizeUrl)
    .optional()
    .or(z.literal('')),
})

/**
 * Experience item schema
 * Title, company, start_date, and description are required
 * Includes length limits to prevent DoS
 */
export const experienceSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Job title is required')
    .max(200, 'Job title is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  company: z
    .string()
    .trim()
    .min(1, 'Company name is required')
    .max(200, 'Company name is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  location: z
    .string()
    .trim()
    .max(200, 'Location is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' })
    .optional()
    .or(z.literal('')),
  start_date: z
    .string()
    .trim()
    .min(1, 'Start date is required')
    .max(50, 'Start date is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  end_date: z
    .string()
    .trim()
    .max(50, 'End date is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' })
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(5000, 'Description is too long (max 5000 characters)')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  highlights: z
    .array(
      z
        .string()
        .trim()
        .max(500)
        .refine(noXssPattern, { message: 'Invalid content detected' })
    )
    .optional(),
})

/**
 * Education item schema
 * Degree and institution are required
 */
export const educationSchema = z.object({
  degree: z
    .string()
    .trim()
    .min(1, 'Degree is required')
    .max(200, 'Degree is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  institution: z
    .string()
    .trim()
    .min(1, 'Institution is required')
    .max(200, 'Institution is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  location: z
    .string()
    .trim()
    .max(200, 'Location is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' })
    .optional()
    .or(z.literal('')),
  graduation_date: z
    .string()
    .trim()
    .max(50, 'Graduation date is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' })
    .optional()
    .or(z.literal('')),
  gpa: z
    .string()
    .trim()
    .max(20, 'GPA is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' })
    .optional()
    .or(z.literal('')),
})

/**
 * Skill category schema
 * Used for grouping skills by category
 */
export const skillSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(100, 'Category is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  items: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Skill cannot be empty')
        .max(100, 'Skill is too long')
        .refine(noXssPattern, { message: 'Invalid content detected' })
    )
    .min(1, 'At least one skill is required'),
})

/**
 * Certification schema
 * Name and issuer are required
 */
export const certificationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Certification name is required')
    .max(200, 'Certification name is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  issuer: z
    .string()
    .trim()
    .min(1, 'Issuer is required')
    .max(200, 'Issuer is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  date: z
    .string()
    .trim()
    .max(50, 'Date is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' })
    .optional()
    .or(z.literal('')),
  url: z
    .string()
    .trim()
    .url({ message: 'Invalid URL' })
    .max(500, 'URL is too long')
    .transform(sanitizeUrl)
    .optional()
    .or(z.literal('')),
})

/**
 * Project schema
 * Title and description are required
 * Includes URL validation and technology list support
 */
export const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Project title is required')
    .max(200, 'Project title is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  description: z
    .string()
    .trim()
    .min(1, 'Project description is required')
    .max(2000, 'Project description is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  year: z
    .string()
    .trim()
    .max(50, 'Year is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' })
    .optional()
    .or(z.literal('')),
  technologies: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Technology cannot be empty')
        .max(100, 'Technology name is too long')
        .refine(noXssPattern, { message: 'Invalid content detected' })
    )
    .optional(),
  url: z
    .string()
    .trim()
    .url({ message: 'Invalid project URL' })
    .max(500, 'Project URL is too long')
    .transform(sanitizeUrl)
    .optional()
    .or(z.literal('')),
})

/**
 * Full resume content schema
 * Used for validating the entire resume data structure
 * Includes comprehensive sanitization and limits to prevent DoS
 */
export const resumeContentSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(200, 'Full name is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  headline: z
    .string()
    .trim()
    .min(1, 'Headline is required')
    .max(200, 'Headline is too long')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  summary: z
    .string()
    .trim()
    .min(1, 'Summary is required')
    .max(10000, 'Summary is too long (max 10000 characters)')
    .refine(noXssPattern, { message: 'Invalid content detected' }),
  contact: contactSchema,
  experience: z
    .array(experienceSchema)
    .min(1, 'At least one experience entry is required')
    .max(10, 'Maximum 10 experience entries allowed'),
  education: z
    .array(educationSchema)
    .max(10, 'Maximum 10 education entries allowed')
    .optional(),
  skills: z
    .array(skillSchema)
    .max(20, 'Maximum 20 skill categories allowed')
    .optional(),
  certifications: z
    .array(certificationSchema)
    .max(20, 'Maximum 20 certifications allowed')
    .optional(),
  projects: z
    .array(projectSchema)
    .max(10, 'Maximum 10 projects allowed')
    .optional(),
})

/**
 * Type inference for TypeScript
 */
export type ContactFormData = z.infer<typeof contactSchema>
export type ExperienceFormData = z.infer<typeof experienceSchema>
export type EducationFormData = z.infer<typeof educationSchema>
export type SkillFormData = z.infer<typeof skillSchema>
export type CertificationFormData = z.infer<typeof certificationSchema>
export type ProjectFormData = z.infer<typeof projectSchema>
export type ResumeContentFormData = z.infer<typeof resumeContentSchema>
