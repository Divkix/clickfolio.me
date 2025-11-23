'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginFormData } from '@/lib/schemas/auth'
import { Brand } from '@/components/Brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoginButton } from '@/components/auth/LoginButton'
import { MagicLinkButton } from '@/components/auth/MagicLinkButton'
import toast from 'react-hot-toast'
import { Toaster } from '@/components/ui/sonner'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  })

  // Watch email field for MagicLinkButton
  const emailValue = watch('email')

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // User is already logged in, check onboarding status
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single()

        if (profile?.onboarding_completed) {
          router.push('/dashboard')
        } else {
          router.push('/wizard')
        }
      } else {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  // Handle email/password login
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        // Security fix: Use generic error message for login failures to prevent email enumeration
        // Only distinguish email confirmation errors (which require different user action)
        if (error.message.includes('Email not confirmed')) {
          toast.error('Please verify your email first')
        } else {
          // Generic error for invalid credentials, user not found, etc.
          toast.error('Invalid email or password')
        }
        return
      }

      // Success - check onboarding status
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single()

        if (profile?.onboarding_completed) {
          router.push('/dashboard')
        } else {
          router.push('/wizard')
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during login'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
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
            {/* Title Section */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome back
              </h1>
              <p className="text-sm text-slate-600">
                Sign in to your account
              </p>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mb-4">
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...register('email')}
                  disabled={isLoading}
                  aria-invalid={!!errors.email}
                  className="transition-all duration-300"
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-indigo-600 hover:text-indigo-700 underline transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  disabled={isLoading}
                  aria-invalid={!!errors.password}
                  className="transition-all duration-300"
                />
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-depth-sm hover:shadow-depth-md transition-all duration-300"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {/* Magic Link Button */}
            <div className="mb-4">
              <MagicLinkButton
                email={emailValue || ''}
                disabled={isLoading}
                onSuccess={() => {
                  // Email will be sent, user will be redirected after clicking link
                }}
                onError={(error) => {
                  console.error('Magic link error:', error)
                }}
              />
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500 font-medium">
                  Or
                </span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <div>
              <LoginButton
                variant="outline"
                size="default"
                className="w-full transition-all duration-300 hover:shadow-depth-sm"
                text="Continue with Google"
              />
            </div>
          </div>

          {/* Footer Text */}
          <p className="mt-6 text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link
              href="/signup"
              className="text-indigo-600 hover:text-indigo-700 underline font-semibold transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
