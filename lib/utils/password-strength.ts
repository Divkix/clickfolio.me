/**
 * Password strength calculation utilities
 * Provides consistent password strength validation across authentication flows
 */

/**
 * Password validation regex patterns (imported from auth schema)
 */
export const PASSWORD_REGEX = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
}

/**
 * Password strength result type
 */
export interface PasswordStrength {
  strength: number
  label: string
  color: string
  barColor: string
}

/**
 * Calculate password strength score (0-100)
 *
 * Scoring breakdown:
 * - Length >= 8 characters: 25 points
 * - Contains uppercase letter: 25 points
 * - Contains lowercase letter: 25 points
 * - Contains number: 12.5 points
 * - Contains special character: 12.5 points
 *
 * @param password - The password to evaluate
 * @returns Strength score from 0 to 100
 */
export function calculatePasswordStrength(password: string): number {
  if (!password) return 0

  let strength = 0

  if (password.length >= 8) strength += 25
  if (PASSWORD_REGEX.uppercase.test(password)) strength += 25
  if (PASSWORD_REGEX.lowercase.test(password)) strength += 25
  if (PASSWORD_REGEX.number.test(password)) strength += 12.5
  if (PASSWORD_REGEX.special.test(password)) strength += 12.5

  return Math.min(strength, 100)
}

/**
 * Get password strength label and color based on strength score
 *
 * Strength tiers:
 * - 0: No label
 * - 1-49: Weak (red)
 * - 50-74: Fair (orange)
 * - 75-99: Good (yellow)
 * - 100: Strong (green)
 *
 * @param strength - Password strength score (0-100)
 * @returns Object containing label, text color, and bar color
 */
export function getPasswordStrengthLabel(strength: number): PasswordStrength {
  if (strength === 0) {
    return {
      strength,
      label: '',
      color: '',
      barColor: '',
    }
  }

  if (strength < 50) {
    return {
      strength,
      label: 'Weak',
      color: 'text-red-600',
      barColor: 'bg-red-600',
    }
  }

  if (strength < 75) {
    return {
      strength,
      label: 'Fair',
      color: 'text-orange-600',
      barColor: 'bg-orange-600',
    }
  }

  if (strength < 100) {
    return {
      strength,
      label: 'Good',
      color: 'text-yellow-600',
      barColor: 'bg-yellow-600',
    }
  }

  return {
    strength,
    label: 'Strong',
    color: 'text-emerald-600',
    barColor: 'bg-emerald-600',
  }
}

/**
 * Get complete password strength evaluation
 * Combines strength calculation with label/color determination
 *
 * @param password - The password to evaluate
 * @returns Complete password strength object
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  const strength = calculatePasswordStrength(password)
  return getPasswordStrengthLabel(strength)
}
