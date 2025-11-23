'use client'

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { validatePDF } from '@/lib/utils/validation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { ArrowRight } from 'lucide-react'

interface FileDropzoneProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function FileDropzone({ open, onOpenChange }: FileDropzoneProps = {}) {
  const isModal = open !== undefined && onOpenChange !== undefined
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
    }
    checkAuth()
  }, [])

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      processFile(droppedFile)
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }

  const processFile = (selectedFile: File) => {
    setError(null)

    const validation = validatePDF(selectedFile)
    if (!validation.valid) {
      setError(validation.error!)
      toast.error(validation.error!)
      return
    }

    setFile(selectedFile)
    uploadFile(selectedFile)
  }

  const uploadFile = async (fileToUpload: File) => {
    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // Step 1: Get presigned URL
      const signResponse = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileToUpload.name }),
      })

      if (!signResponse.ok) {
        const data = await signResponse.json()
        throw new Error(data.error || 'Failed to get upload URL')
      }

      const { uploadUrl, key } = await signResponse.json()

      // Step 2: Upload to R2
      setUploadProgress(25)

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: fileToUpload,
      })

      setUploadProgress(75)

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      setUploadProgress(100)

      // Step 3: Save key to localStorage
      localStorage.setItem('temp_upload_key', key)

      setUploadComplete(true)
      toast.success('File uploaded successfully!')

      // Step 4: If user is authenticated, auto-claim the upload
      if (user) {
        await claimUpload(key)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload file'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const claimUpload = async (key: string) => {
    setClaiming(true)
    setError(null)

    try {
      const claimResponse = await fetch('/api/resume/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })

      if (!claimResponse.ok) {
        const data = await claimResponse.json()
        throw new Error(data.error || 'Failed to claim resume')
      }

      await claimResponse.json()

      // Clear temp key from localStorage
      localStorage.removeItem('temp_upload_key')

      toast.success('Resume claimed successfully! Processing...')

      // Close modal if in modal mode
      if (onOpenChange) {
        onOpenChange(false)
      }

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim resume'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setClaiming(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setUploadComplete(false)
    setClaiming(false)
    setError(null)
    setUploadProgress(0)
  }

  // Dropzone content (before upload complete)
  const dropzoneContent = (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            group relative bg-white rounded-2xl border border-slate-200/60 p-12 cursor-pointer transition-all duration-300 backdrop-blur-sm overflow-hidden
            ${isModal ? '' : 'shadow-depth-md'}
            ${isDragging
              ? 'border-indigo-500 bg-linear-to-br from-indigo-50 to-blue-50 shadow-depth-lg -translate-y-1'
              : isModal ? 'hover:border-indigo-300' : 'hover:shadow-depth-lg hover:-translate-y-1'
            }
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          {/* Subtle gradient overlay on hover */}
          <div className="absolute inset-0 bg-linear-to-br from-indigo-50/50 via-transparent to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <div className="relative z-10 flex flex-col items-center gap-4">
            {/* Icon with gradient background */}
            <div className="relative">
              <div className={`absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-2xl blur-xl transition-opacity duration-300 ${isDragging ? 'opacity-40' : 'opacity-20 group-hover:opacity-40'}`} />
              <div className={`relative bg-linear-to-r from-indigo-100 to-blue-100 p-4 rounded-2xl transition-transform duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-110'}`}>
                <svg
                  className="w-12 h-12"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <defs>
                    <linearGradient id="uploadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4F46E5" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    stroke="url(#uploadGradient)"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
            </div>

            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900 mb-1">
                {file ? file.name : 'Drop your PDF résumé here'}
              </p>
              <p className="text-sm text-slate-500">
                or click to browse • Max 10MB
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center text-slate-500 font-medium">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 shadow-depth-sm">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Info Text - only show when not in modal mode */}
        {!uploading && !error && !isModal && (
          <p className="text-sm text-slate-500 text-center">
            Upload anonymously. No account needed until you&apos;re ready to publish.
          </p>
        )}
      </div>
  )

  // Upload complete state content
  const uploadCompleteContent = (
    <div className="space-y-4">
      <div className={`bg-white rounded-2xl border border-slate-200/60 p-8 ${isModal ? '' : 'shadow-depth-md'}`}>
        {claiming ? (
          /* Claiming State - For Authenticated Users */
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500 to-blue-500 rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative w-16 h-16 bg-linear-to-r from-indigo-100 to-blue-100 rounded-full flex items-center justify-center shadow-depth-md">
                <svg
                  className="w-8 h-8 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="url(#spinnerGradient)"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="url(#spinnerGradient)"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                  <defs>
                    <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4F46E5" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Processing Your Resume...
              </h3>
              <p className="text-sm text-slate-600">
                Claiming your upload and starting AI analysis
              </p>
            </div>
          </div>
        ) : (
          /* Upload Complete - Show different CTA based on auth status */
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-linear-to-r from-emerald-500 to-teal-500 rounded-full blur-xl opacity-30" />
              <div className="relative w-16 h-16 bg-linear-to-r from-emerald-100 to-teal-100 rounded-full flex items-center justify-center shadow-depth-md">
                <svg
                  className="w-8 h-8"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    stroke="url(#successGradient)"
                    d="M5 13l4 4L19 7"
                  />
                  <defs>
                    <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#14B8A6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Resume uploaded! Create your account to continue
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                {file?.name} has been uploaded successfully.
              </p>
            </div>

            {user ? (
              /* Authenticated user - shouldn't reach here as auto-claim happens */
              <p className="text-xs text-slate-500 text-center font-medium">
                Redirecting to dashboard...
              </p>
            ) : (
              /* Anonymous user - show login link */
              <>
                <Link
                  href="/login"
                  className="group relative w-full max-w-xs px-6 py-3 bg-linear-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold shadow-depth-sm hover:shadow-depth-md hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden"
                >
                  {/* Shimmer effect overlay */}
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />

                  <span className="relative z-10">Create Account</span>
                  <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <p className="text-xs text-slate-500 text-center font-medium">
                  Your upload will be automatically claimed after login
                </p>

                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Upload a different file
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // Select content based on upload state
  const content = uploadComplete ? uploadCompleteContent : dropzoneContent

  // When in modal mode, wrap in Dialog
  if (isModal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload New Resume</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return content
}
