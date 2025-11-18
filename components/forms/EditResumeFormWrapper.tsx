'use client'

import { EditResumeForm } from './EditResumeForm'
import type { ResumeContent } from '@/lib/types/database'
import { useRouter } from 'next/navigation'

interface EditResumeFormWrapperProps {
  initialData: ResumeContent
}

export function EditResumeFormWrapper({
  initialData,
}: EditResumeFormWrapperProps) {
  const router = useRouter()

  const handleSave = async (data: ResumeContent) => {
    const response = await fetch('/api/resume/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: data }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update resume')
    }

    // Refresh the page to get updated data
    router.refresh()

    return await response.json()
  }

  return <EditResumeForm initialData={initialData} onSave={handleSave} />
}
