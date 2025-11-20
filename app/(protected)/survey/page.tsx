'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useResumeStatus } from '@/hooks/useResumeStatus'
import { toast } from 'sonner'

function SurveyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume_id')

  const [handle, setHandle] = useState('')
  const [showPhone, setShowPhone] = useState(false)
  const [showAddress, setShowAddress] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handleError, setHandleError] = useState<string | null>(null)

  // Poll resume status in background
  const { status, progress, error: resumeError, canRetry, refetch } = useResumeStatus(resumeId)

  // Redirect to dashboard if no resume_id
  useEffect(() => {
    if (!resumeId) {
      router.push('/dashboard')
    }
  }, [resumeId, router])

  // Validate handle in real-time
  const validateHandle = (value: string) => {
    const trimmed = value.trim().toLowerCase()

    if (trimmed.length === 0) {
      setHandleError(null)
      return
    }

    if (trimmed.length < 3) {
      setHandleError('Handle must be at least 3 characters')
      return
    }

    const handleRegex = /^[a-z0-9-]+$/
    if (!handleRegex.test(trimmed)) {
      setHandleError('Only lowercase letters, numbers, and hyphens allowed')
      return
    }

    setHandleError(null)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase()
    setHandle(value)
    validateHandle(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedHandle = handle.trim().toLowerCase()

    // Validate before submission
    if (!trimmedHandle) {
      setHandleError('Handle is required')
      return
    }

    if (trimmedHandle.length < 3) {
      setHandleError('Handle must be at least 3 characters')
      return
    }

    if (handleError) {
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/profile/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: trimmedHandle,
          privacy_settings: {
            show_phone: showPhone,
            show_address: showAddress,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save profile')
      }

      // Always redirect to dashboard - parsing continues in background
      // Dashboard will show wizard banner if onboarding needs completion
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    // Skip survey and go to dashboard - user can set handle later in settings
    router.push('/dashboard')
  }

  if (!resumeId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        {/* Parsing Status Indicator */}
        <div className="mb-4 bg-white rounded-lg shadow-sm p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {status === 'completed' ? (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              ) : status === 'failed' ? (
                <div className="w-2 h-2 bg-red-500 rounded-full" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              )}
              <span className="text-sm font-medium text-slate-700">
                {status === 'completed'
                  ? 'Resume parsed successfully!'
                  : status === 'failed'
                  ? 'Parsing failed'
                  : 'Parsing your resume in background...'}
              </span>
            </div>
            <span className="text-xs text-slate-500">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Survey Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Claim Your Handle
            </h1>
            <p className="text-slate-600">
              Choose your unique URL while we parse your resume. This will be
              your public link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Handle Input */}
            <div className="space-y-2">
              <label
                htmlFor="handle"
                className="block text-sm font-semibold text-slate-700"
              >
                Your Handle
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  webresume.now/
                </span>
                <Input
                  id="handle"
                  type="text"
                  value={handle}
                  onChange={handleChange}
                  placeholder="yourname"
                  className={`flex-1 ${
                    handleError
                      ? 'border-red-500 focus-visible:ring-red-500'
                      : ''
                  }`}
                  disabled={submitting}
                  autoFocus
                />
              </div>
              {handleError && (
                <p className="text-xs text-red-600">{handleError}</p>
              )}
              <p className="text-xs text-slate-500">
                Lowercase letters, numbers, and hyphens only (min 3 characters)
              </p>
            </div>

            {/* Privacy Settings */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">
                Privacy Settings
              </h3>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label
                    htmlFor="show-phone"
                    className="text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    Show phone number
                  </label>
                  <p className="text-xs text-slate-500">
                    Display your phone on public resume
                  </p>
                </div>
                <Switch
                  id="show-phone"
                  checked={showPhone}
                  onCheckedChange={setShowPhone}
                  disabled={submitting}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label
                    htmlFor="show-address"
                    className="text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    Show full address
                  </label>
                  <p className="text-xs text-slate-500">
                    Display street address (only city/state shown if disabled)
                  </p>
                </div>
                <Switch
                  id="show-address"
                  checked={showAddress}
                  onCheckedChange={setShowAddress}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting || !!handleError || !handle.trim()}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {status === 'completed' ? 'Finishing...' : 'Saving...'}
                  </>
                ) : (
                  'Save & Continue'
                )}
              </Button>

              <Button
                type="button"
                onClick={handleSkip}
                variant="outline"
                disabled={submitting}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Skip
              </Button>
            </div>
          </form>

          {/* Error Alert Box */}
          {status === 'failed' && (
            <Alert className="border-red-200 bg-red-50 mt-6">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertTitle className="text-red-900">Parsing Failed</AlertTitle>
              <AlertDescription className="text-red-800">
                <p className="mb-3">
                  {resumeError || 'Unable to parse your resume. This might be due to unexpected formatting or missing required fields.'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard')}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Go to Dashboard
                  </Button>
                  {canRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        refetch()
                        toast('Retrying...', {
                          description: 'Attempting to parse your resume again',
                        })
                      }}
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Helper Text */}
          <p className="text-xs text-center text-slate-500 mt-6">
            You can change these settings later in your dashboard
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SurveyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <SurveyContent />
    </Suspense>
  )
}
