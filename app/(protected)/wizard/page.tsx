'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ResumeContent } from '@/lib/types/database'
import type { ThemeId } from '@/lib/templates/theme-registry'
import { HandleStep } from '@/components/wizard/HandleStep'
import { ReviewStep } from '@/components/wizard/ReviewStep'
import { PrivacyStep } from '@/components/wizard/PrivacyStep'
import { ThemeStep } from '@/components/wizard/ThemeStep'
import { WizardProgress } from '@/components/wizard'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

interface WizardState {
  currentStep: number
  resumeData: ResumeContent | null
  handle: string
  privacySettings: {
    show_phone: boolean
    show_address: boolean
  }
  themeId: ThemeId
}

const TOTAL_STEPS = 4

/**
 * Wizard Page - Multi-step onboarding flow
 * Guides users through completing their profile setup
 *
 * Steps:
 * 1. Handle Selection - Choose unique username
 * 2. Content Review - Verify parsed resume data
 * 3. Privacy Settings - Configure visibility of sensitive info
 * 4. Theme Selection - Choose resume template design
 */
export default function WizardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    resumeData: null,
    handle: '',
    privacySettings: {
      show_phone: false,
      show_address: false,
    },
    themeId: 'minimalist_editorial',
  })

  // Fetch resume data on mount + handle upload claiming
  useEffect(() => {
    const initializeWizard = async () => {
      try {
        setLoading(true)
        const supabase = createClient()

        // 1. Check authentication
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/')
          return
        }

        // 2. Check for pending upload claim
        const tempKey = localStorage.getItem('temp_upload_key')
        if (tempKey) {
          // Claim the upload
          setLoading(true)
          try {
            const claimResponse = await fetch('/api/resume/claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: tempKey }),
            })

            const claimData = await claimResponse.json()

            if (!claimResponse.ok) {
              throw new Error(claimData.error || 'Failed to claim resume')
            }

            // Get resume_id from claim response
            const resumeId = claimData.resume_id

            // Clear localStorage after successful claim
            localStorage.removeItem('temp_upload_key')

            // Subscribe to Realtime updates for this resume
            const parsingComplete = await new Promise<boolean>((resolve) => {
              const timeoutId: { current: NodeJS.Timeout | null } = { current: null }

              const channel = supabase
                .channel(`wizard-resume-${resumeId}`)
                .on(
                  'postgres_changes',
                  {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'resumes',
                    filter: `id=eq.${resumeId}`,
                  },
                  (payload) => {
                    const newStatus = payload.new?.status

                    if (newStatus === 'completed') {
                      if (timeoutId.current) clearTimeout(timeoutId.current)
                      channel.unsubscribe()
                      supabase.removeChannel(channel)
                      resolve(true)
                    }

                    if (newStatus === 'failed') {
                      if (timeoutId.current) clearTimeout(timeoutId.current)
                      channel.unsubscribe()
                      supabase.removeChannel(channel)
                      setError(payload.new?.error_message || 'Resume parsing failed. Please try again.')
                      setTimeout(() => router.push('/dashboard'), 3000)
                      resolve(false)
                    }
                  }
                )
                .subscribe()

              // Timeout after 90 seconds
              timeoutId.current = setTimeout(() => {
                channel.unsubscribe()
                supabase.removeChannel(channel)
                router.push(`/waiting?resume_id=${resumeId}`)
                resolve(false)
              }, 90000)
            })

            if (!parsingComplete) {
              return
            }
          } catch (claimError) {
            console.error('Claim error:', claimError)
            setError(claimError instanceof Error ? claimError.message : 'Failed to claim resume')
            localStorage.removeItem('temp_upload_key')
            setTimeout(() => router.push('/dashboard'), 3000)
            return
          }
        }

        // 3. Fetch site_data (contains parsed resume content)
        const { data: siteData } = await supabase
          .from('site_data')
          .select('content')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!siteData) {
          // Resume is still parsing, check status and redirect appropriately
          const { data: resume } = await supabase
            .from('resumes')
            .select('id, status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (resume) {
            if (resume.status === 'processing') {
              // Redirect to waiting page for active parsing
              router.push(`/waiting?resume_id=${resume.id}`)
            } else {
              // Other statuses, go to dashboard
              setError('No resume data found. Please upload a resume first.')
              setTimeout(() => router.push('/dashboard'), 2000)
            }
          } else {
            // No resume at all
            setError('No resume data found. Please upload a resume first.')
            setTimeout(() => router.push('/dashboard'), 2000)
          }
          return
        }

        const content = siteData.content as unknown as ResumeContent

        // 4. Load resume data into state
        setState((prev) => ({
          ...prev,
          resumeData: content,
        }))
      } catch (err) {
        console.error('Error initializing wizard:', err)
        setError('Failed to load resume data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    initializeWizard()
  }, [router])

  // Handler for handle selection (Step 1)
  const handleHandleContinue = (handle: string) => {
    setState((prev) => ({
      ...prev,
      handle,
      currentStep: 2,
    }))
  }

  // Handler for review continue (Step 2)
  const handleReviewContinue = () => {
    setState((prev) => ({ ...prev, currentStep: 3 }))
  }

  // Handler for privacy settings (Step 3)
  const handlePrivacyContinue = (settings: { show_phone: boolean; show_address: boolean }) => {
    setState((prev) => ({
      ...prev,
      privacySettings: settings,
      currentStep: 4,
    }))
  }

  // Handler for wizard completion (Step 4)
  const handleThemeContinue = async (themeId: ThemeId) => {
    try {
      // Update local state
      setState((prev) => ({
        ...prev,
        themeId,
      }))

      // Call wizard completion API
      const response = await fetch('/api/wizard/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: state.handle,
          privacy_settings: state.privacySettings,
          theme_id: themeId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete setup')
      }

      // Show success message and redirect
      toast.success('Profile setup completed successfully!')
      router.push('/dashboard')
    } catch (err) {
      console.error('Error completing wizard:', err)
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to complete setup'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  // Calculate progress percentage
  const progress = (state.currentStep / TOTAL_STEPS) * 100

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading your resume...</p>
          <p className="text-slate-500 text-sm mt-2">This may take 30-60 seconds if we&apos;re parsing your PDF</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && state.currentStep === 1) {
    return (
      <div className="min-h-screen bg-linear-to-br from-indigo-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-depth-md border border-red-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Something Went Wrong
          </h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    )
  }

  // Main wizard UI
  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-blue-50 to-cyan-50">
      {/* Progress Indicator */}
      <WizardProgress
        currentStep={state.currentStep}
        totalSteps={TOTAL_STEPS}
        progress={progress}
      />

      {/* Step Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Error Alert (shown inline for steps 2-4) */}
        {error && state.currentStep > 1 && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-900">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Step 1: Handle Selection */}
        {state.currentStep === 1 && (
          <HandleStep
            initialHandle={state.handle}
            onContinue={handleHandleContinue}
          />
        )}

        {/* Step 2: Content Review */}
        {state.currentStep === 2 && state.resumeData && (
          <ReviewStep
            content={state.resumeData}
            onContinue={handleReviewContinue}
          />
        )}

        {/* Step 3: Privacy Settings */}
        {state.currentStep === 3 && state.resumeData && (
          <PrivacyStep
            content={state.resumeData}
            initialSettings={state.privacySettings}
            onContinue={handlePrivacyContinue}
          />
        )}

        {/* Step 4: Theme Selection */}
        {state.currentStep === 4 && (
          <ThemeStep
            initialTheme={state.themeId}
            onContinue={handleThemeContinue}
          />
        )}
      </main>
    </div>
  )
}
