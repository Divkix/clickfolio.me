import { z } from "zod";
import {
	noXssPattern,
	sanitizeEmail,
	sanitizePhone,
	sanitizeText,
	sanitizeUrl,
} from "@/lib/utils/sanitization";

/**
 * Email validation regexes
 * - Lenient: accepts text@text (TLD optional) for AI-parsed incomplete emails
 * - Strict: requires TLD with at least 2 characters for user-entered emails
 */
const LENIENT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+$/;
const STRICT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Factory function to create contact schema with configurable email validation
 */
const createContactSchema = (emailRegex: RegExp, emailErrorMessage: string) =>
	z.object({
		email: z
			.string()
			.trim()
			.min(1, "Email is required")
			.max(255, "Email is too long")
			.refine((val) => emailRegex.test(val), {
				message: emailErrorMessage,
			})
			.transform(sanitizeEmail)
			.describe("Email address"),
		phone: z
			.string()
			.trim()
			.max(50, "Phone number is too long")
			.transform(sanitizePhone)
			.optional()
			.or(z.literal(""))
			.describe("Phone number"),
		location: z
			.string()
			.trim()
			.max(255, "Location is too long")
			.refine(noXssPattern, { message: "Invalid content detected" })
			.transform(sanitizeText)
			.optional()
			.or(z.literal(""))
			.describe("City, State format preferred"),
		linkedin: z
			.string()
			.trim()
			.url({ message: "Invalid LinkedIn URL" })
			.max(500, "LinkedIn URL is too long")
			.transform(sanitizeUrl)
			.optional()
			.or(z.literal(""))
			.describe(
				"Full LinkedIn URL. Must start with https://linkedin.com/in/ or https://www.linkedin.com/in/",
			),
		github: z
			.string()
			.trim()
			.url({ message: "Invalid GitHub URL" })
			.max(500, "GitHub URL is too long")
			.transform(sanitizeUrl)
			.optional()
			.or(z.literal(""))
			.describe("Full GitHub URL. Must start with https://github.com/"),
		website: z
			.string()
			.trim()
			.url({ message: "Invalid website URL" })
			.max(500, "Website URL is too long")
			.transform(sanitizeUrl)
			.optional()
			.or(z.literal(""))
			.describe("Full website URL. Must start with https:// or http://"),
		behance: z
			.string()
			.trim()
			.url({ message: "Invalid Behance URL" })
			.max(500, "Behance URL is too long")
			.transform(sanitizeUrl)
			.optional()
			.or(z.literal(""))
			.describe("Full Behance URL. Must start with https://behance.net/"),
		dribbble: z
			.string()
			.trim()
			.url({ message: "Invalid Dribbble URL" })
			.max(500, "Dribbble URL is too long")
			.transform(sanitizeUrl)
			.optional()
			.or(z.literal(""))
			.describe("Full Dribbble URL. Must start with https://dribbble.com/"),
	});

/**
 * Contact schemas
 * - Lenient: for AI-parsed content (accepts incomplete emails like "user@domain")
 * - Strict: for user edits (requires full email with TLD like "user@domain.com")
 */
const contactSchemaLenient = createContactSchema(
	LENIENT_EMAIL_REGEX,
	"Invalid email format",
);
const contactSchemaStrict = createContactSchema(
	STRICT_EMAIL_REGEX,
	"Invalid email format (must include domain extension, e.g., .com)",
);

/**
 * Experience item schema
 * Title, company, start_date, and description are required
 * Includes length limits to prevent DoS
 */
const experienceSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1, "Job title is required")
		.max(200, "Job title is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("Job title"),
	company: z
		.string()
		.trim()
		.min(1, "Company name is required")
		.max(200, "Company name is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("Company name"),
	location: z
		.string()
		.trim()
		.max(200, "Location is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.optional()
		.or(z.literal(""))
		.describe("Job location"),
	start_date: z
		.string()
		.trim()
		.min(1, "Start date is required")
		.max(50, "Start date is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("Format: YYYY-MM or Month YYYY"),
	end_date: z
		.string()
		.trim()
		.max(50, "End date is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.optional()
		.or(z.literal(""))
		.describe("Format: YYYY-MM or Month YYYY. Omit for current role."),
	description: z
		.string()
		.trim()
		.min(1, "Description is required")
		.max(5000, "Description is too long (max 5000 characters)")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("Role description (max 5000 characters)"),
	highlights: z
		.array(
			z
				.string()
				.trim()
				.max(500)
				.refine(noXssPattern, { message: "Invalid content detected" }),
		)
		.optional()
		.describe(
			"Key achievements or responsibilities (max 500 characters per item)",
		),
});

/**
 * Education item schema
 * Degree and institution are required
 */
const educationSchema = z.object({
	degree: z
		.string()
		.trim()
		.min(1, "Degree is required")
		.max(200, "Degree is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("Degree name"),
	institution: z
		.string()
		.trim()
		.min(1, "Institution is required")
		.max(200, "Institution is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("University or school name. Always include this field."),
	location: z
		.string()
		.trim()
		.max(200, "Location is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.optional()
		.or(z.literal(""))
		.describe("School location"),
	graduation_date: z
		.string()
		.trim()
		.max(50, "Graduation date is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.optional()
		.or(z.literal(""))
		.describe("Graduation date"),
	gpa: z
		.string()
		.trim()
		.max(20, "GPA is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.optional()
		.or(z.literal(""))
		.describe("GPA if applicable"),
});

/**
 * Skill category schema
 * Used for grouping skills by category
 */
const skillSchema = z.object({
	category: z
		.string()
		.trim()
		.min(1, "Category is required")
		.max(100, "Category is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("Skill category (e.g., Languages, Frameworks)"),
	items: z
		.array(
			z
				.string()
				.trim()
				.min(1, "Skill cannot be empty")
				.max(100, "Skill is too long")
				.refine(noXssPattern, { message: "Invalid content detected" }),
		)
		.min(1, "At least one skill is required")
		.describe("List of skills in this category. Must have at least one item."),
});

/**
 * Certification schema
 * Name and issuer are required
 */
const certificationSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Certification name is required")
		.max(200, "Certification name is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("Certification name"),
	issuer: z
		.string()
		.trim()
		.min(1, "Issuer is required")
		.max(200, "Issuer is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe(
			"Organization that issued the certification. Always include this field.",
		),
	date: z
		.string()
		.trim()
		.max(50, "Date is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.optional()
		.or(z.literal(""))
		.describe("Date obtained"),
	url: z
		.string()
		.trim()
		.url({ message: "Invalid URL" })
		.max(500, "URL is too long")
		.transform(sanitizeUrl)
		.optional()
		.or(z.literal(""))
		.describe("Certification URL. Must start with https:// or http://"),
});

/**
 * Project schema
 * Title and description are required
 * Includes URL validation and technology list support
 */
const projectSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1, "Project title is required")
		.max(200, "Project title is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe("Project name or title"),
	description: z
		.string()
		.trim()
		.min(1, "Project description is required")
		.max(2000, "Project description is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.describe(
			"Brief description of the project and its impact (1-2 sentences, max 2000 characters)",
		),
	year: z
		.string()
		.trim()
		.max(50, "Year is too long")
		.refine(noXssPattern, { message: "Invalid content detected" })
		.optional()
		.or(z.literal(""))
		.describe("Year completed or date range"),
	technologies: z
		.array(
			z
				.string()
				.trim()
				.min(1, "Technology cannot be empty")
				.max(100, "Technology name is too long")
				.refine(noXssPattern, { message: "Invalid content detected" }),
		)
		.optional()
		.describe("Technologies, frameworks, or tools used"),
	url: z
		.string()
		.trim()
		.url({ message: "Invalid project URL" })
		.max(500, "Project URL is too long")
		.transform(sanitizeUrl)
		.optional()
		.or(z.literal(""))
		.describe("Project URL or demo link. Must start with https:// or http://"),
	image_url: z
		.string()
		.trim()
		.url({ message: "Invalid image URL" })
		.max(500, "Image URL is too long")
		.transform(sanitizeUrl)
		.optional()
		.or(z.literal(""))
		.describe(
			"URL to project screenshot or thumbnail image. Must start with https:// or http://",
		),
});

/**
 * Factory function to create resume content schema with configurable contact validation
 */
const createResumeContentSchema = (
	contactSchema: ReturnType<typeof createContactSchema>,
) =>
	z.object({
		full_name: z
			.string()
			.trim()
			.min(1, "Full name is required")
			.max(200, "Full name is too long")
			.refine(noXssPattern, { message: "Invalid content detected" })
			.describe("Full name of the person"),
		headline: z
			.string()
			.trim()
			.min(1, "Headline is required")
			.max(200, "Headline is too long")
			.refine(noXssPattern, { message: "Invalid content detected" })
			.describe(
				"Headline (recommended: max 10 words, under 100 characters; enforced: max 200 characters)",
			),
		summary: z
			.string()
			.trim()
			.min(1, "Summary is required")
			.max(10000, "Summary is too long (max 10000 characters)")
			.refine(noXssPattern, { message: "Invalid content detected" })
			.describe(
				"Professional summary or objective statement (2-4 sentences, max 10000 characters)",
			),
		contact: contactSchema.describe("Contact information"),
		experience: z
			.array(experienceSchema)
			.max(10, "Maximum 10 experience entries allowed")
			.describe("Work experience in reverse chronological order"),
		education: z
			.array(educationSchema)
			.max(10, "Maximum 10 education entries allowed")
			.optional()
			.describe("Education history. Return empty array [] if absent."),
		skills: z
			.array(skillSchema)
			.max(20, "Maximum 20 skill categories allowed")
			.optional()
			.describe("Skills grouped by category. Return empty array [] if absent."),
		certifications: z
			.array(certificationSchema)
			.max(20, "Maximum 20 certifications allowed")
			.optional()
			.describe(
				"Professional certifications. Return empty array [] if absent.",
			),
		projects: z
			.array(projectSchema)
			.max(10, "Maximum 10 projects allowed")
			.optional()
			.describe(
				"Personal projects, side work, portfolio pieces. Return empty array [] if absent.",
			),
		professional_level: z
			.enum(["student", "entry_level", "mid_level", "senior", "executive"])
			.optional()
			.describe(
				"Classify career level from experience/titles/education. " +
					"student: enrolled or only internships. entry_level: 0-2 years. " +
					"mid_level: 3-6 years. senior: 7+ years or senior/staff/lead/principal titles. " +
					"executive: director/VP/C-suite/founder. Omit if uncertain.",
			),
	});

/**
 * Resume content schemas
 * - resumeContentSchema: Lenient validation for AI-parsed content (TLD optional)
 * - resumeContentSchemaStrict: Strict validation for user edits (requires TLD)
 */
export const resumeContentSchema =
	createResumeContentSchema(contactSchemaLenient);
export const resumeContentSchemaStrict =
	createResumeContentSchema(contactSchemaStrict);

/**
 * Type inference for TypeScript
 * Both schemas have the same output type after transformation
 */
export type ResumeContentFormData = z.infer<typeof resumeContentSchema>;
