'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  showStrengthIndicator?: boolean
  placeholder?: string
}

type PasswordStrength = 'weak' | 'medium' | 'strong' | null

const PASSWORD_REQUIREMENTS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
}

function calculatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return null

  const meetsRequirements = {
    length: password.length >= 8,
    uppercase: PASSWORD_REQUIREMENTS.uppercase.test(password),
    lowercase: PASSWORD_REQUIREMENTS.lowercase.test(password),
    number: PASSWORD_REQUIREMENTS.number.test(password),
    special: PASSWORD_REQUIREMENTS.special.test(password),
  }

  const requirementsMet = Object.values(meetsRequirements).filter(Boolean).length

  if (requirementsMet >= 5) return 'strong'
  if (requirementsMet >= 3 && meetsRequirements.length) return 'medium'
  return 'weak'
}

export function PasswordInput({
  value,
  onChange,
  error,
  disabled = false,
  showStrengthIndicator = false,
  placeholder = '••••••••',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const strength = showStrengthIndicator ? calculatePasswordStrength(value) : null

  const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  }

  const strengthText = {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
  }

  const strengthTextColors = {
    weak: 'text-red-600',
    medium: 'text-yellow-600',
    strong: 'text-green-600',
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete="current-password"
          aria-invalid={!!error}
          className={cn(
            'pr-10 transition-all duration-300',
            error && 'border-red-500 focus-visible:ring-red-500/20'
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 hover:text-slate-700"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>

      {showStrengthIndicator && strength && (
        <div className="space-y-1">
          <div className="flex gap-1">
            <div
              className={cn(
                'h-1 flex-1 rounded-full transition-all duration-300',
                strength ? strengthColors[strength] : 'bg-slate-200'
              )}
            />
            <div
              className={cn(
                'h-1 flex-1 rounded-full transition-all duration-300',
                strength === 'medium' || strength === 'strong'
                  ? strengthColors[strength]
                  : 'bg-slate-200'
              )}
            />
            <div
              className={cn(
                'h-1 flex-1 rounded-full transition-all duration-300',
                strength === 'strong' ? strengthColors[strength] : 'bg-slate-200'
              )}
            />
          </div>
          <p
            className={cn(
              'text-xs font-medium transition-colors duration-300',
              strengthTextColors[strength]
            )}
          >
            {strengthText[strength]}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs font-medium text-red-600 animate-fade-in-up">
          {error}
        </p>
      )}
    </div>
  )
}
