'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/schemas/auth'
import { evaluatePasswordStrength } from '@/lib/utils/password-strength'
import { Brand } from '@/components/Brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import toast from 'react-hot-toast'
import { Toaster } from '@/components/ui/sonner'
import { CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'

type FormState = 'idle' | 'submitting' | 'success' | 'error'
type TokenState = 'checking' | 'valid' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [formState, setFormState] = useState<FormState>('idle')
  const [tokenState, setTokenState] = useState<TokenState>('checking')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
  })

  // Watch password field for strength indicator
  const passwordValue = watch('password')

  // Check for valid reset token on mount
  useEffect(() => {
    const checkToken = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
          setTokenState('invalid')
        } else {
          setTokenState('valid')
        }
      } catch (error) {
        console.error('Token validation error:', error)
        setTokenState('invalid')
      }
    }

    checkToken()
  }, [supabase])

  // Handle password reset form submission
  const onSubmit = async (data: ResetPasswordFormData) => {
    setFormState('submitting')

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      })

      if (error) {
        // Handle specific error cases
        if (error.message.includes('session')) {
          toast.error('Reset link has expired. Please request a new one.')
          setFormState('error')
          setTokenState('invalid')
        } else if (error.message.includes('Password')) {
          toast.error('Password does not meet requirements')
          setFormState('error')
        } else {
          toast.error(error.message)
          setFormState('error')
        }
        return
      }

      // Success - show success state and redirect after 3 seconds
      setFormState('success')
      toast.success('Password updated successfully!')

      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password'
      toast.error(errorMessage)
      setFormState('error')
    }
  }

  // Calculate password strength using shared utility
  const passwordStrengthResult = evaluatePasswordStrength(passwordValue || '')

  // Show loading state while checking token
  if (tokenState === 'checking') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Verifying reset link...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Toaster />

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-md shadow-depth-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-block">
            <Brand size="lg" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-depth-md p-8">
            {tokenState === 'invalid' ? (
              /* Invalid Token State */
              <div className="text-center">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 mb-6 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 rounded-full opacity-20 blur-xl" />
                  <div className="relative w-full h-full bg-gradient-to-r from-red-100 to-orange-100 rounded-full flex items-center justify-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-orange-600 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  Invalid or expired link
                </h1>

                {/* Message */}
                <p className="text-slate-600 mb-6">
                  This password reset link has expired or is invalid. Please request a new one.
                </p>

                {/* Request new link button */}
                <Link href="/forgot-password">
                  <Button className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-depth-sm hover:shadow-depth-md transition-all duration-300">
                    Request new reset link
                  </Button>
                </Link>

                {/* Back to login */}
                <p className="mt-6 text-sm text-slate-600">
                  <Link
                    href="/login"
                    className="text-indigo-600 hover:text-indigo-700 underline font-semibold transition-colors"
                  >
                    Back to Sign in
                  </Link>
                </p>
              </div>
            ) : formState === 'success' ? (
              /* Success State */
              <div className="text-center">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 mb-6 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full opacity-20 blur-xl" />
                  <div className="relative w-full h-full bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full flex items-center justify-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  Password updated
                </h1>

                {/* Message */}
                <p className="text-slate-600 mb-6">
                  Your password has been successfully reset. You can now sign in with your new password.
                </p>

                {/* Redirect message */}
                <p className="text-sm text-slate-500 mb-6">
                  Redirecting you to sign in...
                </p>

                {/* Manual redirect button */}
                <Link href="/login">
                  <Button className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-depth-sm hover:shadow-depth-md transition-all duration-300">
                    Sign in now
                  </Button>
                </Link>
              </div>
            ) : (
              /* Reset Password Form */
              <>
                {/* Title Section */}
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    Create new password
                  </h1>
                  <p className="text-sm text-slate-600">
                    Enter your new password below
                  </p>
                </div>

                {/* Password Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mb-6">
                  {/* Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        {...register('password')}
                        disabled={formState === 'submitting'}
                        aria-invalid={!!errors.password}
                        className="transition-all duration-300 pr-10"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-red-600">{errors.password.message}</p>
                    )}

                    {/* Password Strength Indicator */}
                    {passwordValue && passwordValue.length > 0 && (
                      <div className="space-y-1">
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${passwordStrengthResult.barColor}`}
                            style={{ width: `${passwordStrengthResult.strength}%` }}
                          />
                        </div>
                        {passwordStrengthResult.label && (
                          <p className={`text-xs font-medium ${passwordStrengthResult.color}`}>
                            Password strength: {passwordStrengthResult.label}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                        {...register('confirmPassword')}
                        disabled={formState === 'submitting'}
                        aria-invalid={!!errors.confirmPassword}
                        className="transition-all duration-300 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={formState === 'submitting'}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
                  >
                    {formState === 'submitting' ? 'Resetting password...' : 'Reset password'}
                  </Button>
                </form>

                {/* Back to login link */}
                <p className="text-center text-sm text-slate-600">
                  Remember your password?{' '}
                  <Link
                    href="/login"
                    className="text-indigo-600 hover:text-indigo-700 underline font-semibold transition-colors"
                  >
                    Back to Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
