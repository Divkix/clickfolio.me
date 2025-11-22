'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface EmailInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  autoFocus?: boolean
}

export function EmailInput({
  value,
  onChange,
  error,
  disabled = false,
  autoFocus = false,
}: EmailInputProps) {
  return (
    <div className="space-y-1.5">
      <Input
        type="email"
        placeholder="you@example.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="email"
        aria-invalid={!!error}
        className={cn(
          'transition-all duration-300',
          error && 'border-red-500 focus-visible:ring-red-500/20'
        )}
      />
      {error && (
        <p className="text-xs font-medium text-red-600 animate-fade-in-up">
          {error}
        </p>
      )}
    </div>
  )
}
