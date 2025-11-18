'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export default function OnboardingPage() {
  const router = useRouter()
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const claimUpload = async () => {
      const tempKey = localStorage.getItem('temp_upload_key')

      if (!tempKey) {
        // No upload to claim, go to dashboard
        router.push('/dashboard')
        return
      }

      setClaiming(true)
      setProgress(20)

      try {
        setProgress(40)

        const response = await fetch('/api/resume/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: tempKey }),
        })

        setProgress(70)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to claim resume')
        }

        setProgress(100)

        // Clear localStorage
        localStorage.removeItem('temp_upload_key')

        // Show success and redirect
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to claim resume')
        setClaiming(false)
        setProgress(0)
      }
    }

    claimUpload()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 flex items-center justify-center px-4">
        <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-lg p-8">
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Claim Failed
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-lg p-8">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg
            className="w-8 h-8 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {claiming && progress < 100
            ? 'Claiming Your Resume...'
            : 'Success!'}
        </h1>

        <p className="text-gray-600 mb-6">
          {claiming && progress < 100
            ? 'Please wait while we save your resume.'
            : 'Redirecting to your dashboard...'}
        </p>

        {claiming && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500">{progress}% complete</p>
          </div>
        )}
      </div>
    </div>
  )
}
