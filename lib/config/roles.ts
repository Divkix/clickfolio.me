// Single source of truth for career level. Pure module (no drizzle/zod) so it is safe for the
// DB schema, drizzle-kit, Zod schemas, and client components alike.
export const ROLE_LABELS = {
  student: "Student",
  entry_level: "Entry Level",
  mid_level: "Mid Level",
  senior: "Senior",
  executive: "Executive",
} as const;

export type UserRole = keyof typeof ROLE_LABELS;

// SAFETY: Object.keys returns string[]; ROLE_LABELS keys are exactly UserRole.
export const USER_ROLES = Object.keys(ROLE_LABELS) as [UserRole, ...UserRole[]];

export const ROLE_OPTIONS = USER_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

export function isUserRole(value: string | undefined): value is UserRole {
  return value !== undefined && Object.hasOwn(ROLE_LABELS, value);
}
