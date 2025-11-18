import { z } from 'zod'

/**
 * Contact information schema
 * Email is required, all other fields are optional
 */
export const contactSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255, 'Email is too long'),
  phone: z
    .string()
    .max(50, 'Phone number is too long')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .max(255, 'Location is too long')
    .optional()
    .or(z.literal('')),
  linkedin: z
    .string()
    .url('Invalid LinkedIn URL')
    .max(500, 'LinkedIn URL is too long')
    .optional()
    .or(z.literal('')),
  github: z
    .string()
    .url('Invalid GitHub URL')
    .max(500, 'GitHub URL is too long')
    .optional()
    .or(z.literal('')),
  website: z
    .string()
    .url('Invalid website URL')
    .max(500, 'Website URL is too long')
    .optional()
    .or(z.literal('')),
})

/**
 * Experience item schema
 * Title, company, start_date, and description are required
 */
export const experienceSchema = z.object({
  title: z
    .string()
    .min(1, 'Job title is required')
    .max(200, 'Job title is too long'),
  company: z
    .string()
    .min(1, 'Company name is required')
    .max(200, 'Company name is too long'),
  location: z
    .string()
    .max(200, 'Location is too long')
    .optional()
    .or(z.literal('')),
  start_date: z
    .string()
    .min(1, 'Start date is required')
    .max(50, 'Start date is too long'),
  end_date: z
    .string()
    .max(50, 'End date is too long')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description is too long (max 2000 characters)'),
  highlights: z.array(z.string().max(500)).optional(),
})

/**
 * Education item schema
 * Degree and institution are required
 */
export const educationSchema = z.object({
  degree: z
    .string()
    .min(1, 'Degree is required')
    .max(200, 'Degree is too long'),
  institution: z
    .string()
    .min(1, 'Institution is required')
    .max(200, 'Institution is too long'),
  location: z
    .string()
    .max(200, 'Location is too long')
    .optional()
    .or(z.literal('')),
  graduation_date: z
    .string()
    .max(50, 'Graduation date is too long')
    .optional()
    .or(z.literal('')),
  gpa: z.string().max(20, 'GPA is too long').optional().or(z.literal('')),
})

/**
 * Skill category schema
 * Used for grouping skills by category
 */
export const skillSchema = z.object({
  category: z
    .string()
    .min(1, 'Category is required')
    .max(100, 'Category is too long'),
  items: z
    .array(z.string().min(1, 'Skill cannot be empty').max(100, 'Skill is too long'))
    .min(1, 'At least one skill is required'),
})

/**
 * Certification schema
 * Name and issuer are required
 */
export const certificationSchema = z.object({
  name: z
    .string()
    .min(1, 'Certification name is required')
    .max(200, 'Certification name is too long'),
  issuer: z
    .string()
    .min(1, 'Issuer is required')
    .max(200, 'Issuer is too long'),
  date: z
    .string()
    .max(50, 'Date is too long')
    .optional()
    .or(z.literal('')),
  url: z
    .string()
    .url('Invalid URL')
    .max(500, 'URL is too long')
    .optional()
    .or(z.literal('')),
})

/**
 * Full resume content schema
 * Used for validating the entire resume data structure
 */
export const resumeContentSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Full name is required')
    .max(200, 'Full name is too long'),
  headline: z
    .string()
    .min(1, 'Headline is required')
    .max(200, 'Headline is too long'),
  summary: z
    .string()
    .min(1, 'Summary is required')
    .max(1000, 'Summary is too long (max 1000 characters)'),
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
})

/**
 * Type inference for TypeScript
 */
export type ContactFormData = z.infer<typeof contactSchema>
export type ExperienceFormData = z.infer<typeof experienceSchema>
export type EducationFormData = z.infer<typeof educationSchema>
export type SkillFormData = z.infer<typeof skillSchema>
export type CertificationFormData = z.infer<typeof certificationSchema>
export type ResumeContentFormData = z.infer<typeof resumeContentSchema>
