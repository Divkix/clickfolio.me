// Single source of truth for career level. Pure module (no drizzle/zod) so it is safe for the
// DB schema, drizzle-kit, Zod schemas, and client components alike. `criteria` is the rubric
// Jev classifies against (lib/ai/career.ts): one sentence of observable evidence per level.
export const ROLES = {
  student: {
    label: "Student",
    criteria: "Currently enrolled, or has only internships/student jobs and no full-time role yet.",
  },
  entry_level: {
    label: "Entry Level",
    criteria: "0-2 years of full-time experience, junior/associate/new-grad titles.",
  },
  mid_level: {
    label: "Mid Level",
    criteria: "3-6 years of full-time experience without senior/lead titles.",
  },
  senior: {
    label: "Senior",
    criteria:
      "7+ years of experience, or a senior/staff/principal/lead title as an individual contributor.",
  },
  manager: {
    label: "Manager",
    criteria:
      "Current title manages people below director: manager, engineering manager, team lead with direct reports.",
  },
  executive: {
    label: "Executive",
    criteria:
      "Current title is director, head of a function, VP, C-suite, partner, or founder/owner of a company.",
  },
} as const;

export type UserRole = keyof typeof ROLES;

// SAFETY: Object.keys returns string[]; ROLES keys are exactly UserRole.
export const USER_ROLES = Object.keys(ROLES) as [UserRole, ...UserRole[]];

export const ROLE_OPTIONS = USER_ROLES.map((value) => ({ value, label: ROLES[value].label }));

export function isUserRole(value: string | undefined): value is UserRole {
  return value !== undefined && Object.hasOwn(ROLES, value);
}
