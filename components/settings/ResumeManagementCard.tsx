'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/FileDropzone'
import { Upload, FileText, Calendar } from 'lucide-react'

interface ResumeManagementCardProps {
  resumeCount: number
  latestResumeDate?: string | null
  latestResumeStatus?: string | null
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ResumeManagementCard({
  resumeCount,
  latestResumeDate,
  latestResumeStatus
}: ResumeManagementCardProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-100'
      case 'processing':
        return 'text-blue-700 bg-blue-100'
      case 'failed':
        return 'text-red-700 bg-red-100'
      default:
        return 'text-slate-700 bg-slate-100'
    }
  }

  const getStatusLabel = (status?: string | null) => {
    switch (status) {
      case 'completed':
        return 'Published'
      case 'processing':
        return 'Processing'
      case 'failed':
        return 'Failed'
      case 'pending_claim':
        return 'Pending'
      default:
        return 'Unknown'
    }
  }

  return (
    <>
      <Card className="shadow-depth-sm border-slate-200/60 hover:shadow-depth-md transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            Resume Management
          </CardTitle>
          <CardDescription className="text-slate-600">
            Upload and manage your resume versions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resume Stats */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Total Uploads</p>
              <p className="text-2xl font-bold text-slate-900">{resumeCount}</p>
            </div>
            {latestResumeStatus && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">Current Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(latestResumeStatus)}`}>
                  {getStatusLabel(latestResumeStatus)}
                </span>
              </div>
            )}
          </div>

          {/* Latest Resume Info */}
          {latestResumeDate && (
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-medium text-slate-700">Latest Upload</p>
              </div>
              <p className="text-sm text-slate-600">
                {formatDate(latestResumeDate)}
              </p>
            </div>
          )}

          {/* Upload New Resume Button */}
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 shadow-depth-sm hover:shadow-depth-md"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload New Resume
          </Button>

          {/* Info Text */}
          <p className="text-xs text-slate-500 text-center">
            Rate limit: 5 uploads per 24 hours. All uploads are kept for history.
          </p>
        </CardContent>
      </Card>

      <FileDropzone
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />
    </>
  )
}
