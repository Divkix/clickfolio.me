import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EditResumeFormWrapper } from '@/components/forms/EditResumeFormWrapper'
import type { ResumeContent } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function EditPage() {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch user's site data
  const { data: siteData, error } = await supabase
    .from('site_data')
    .select('id, content')
    .eq('user_id', user.id)
    .single()

  // If no site data exists, redirect to dashboard
  if (error || !siteData) {
    redirect('/dashboard')
  }

  // Type assertion for content (safe because we control the schema)
  const content = siteData.content as unknown as ResumeContent

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Edit Resume</h1>
              <p className="text-sm text-gray-600">
                Update your resume content and publish changes
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EditResumeFormWrapper initialData={content} />
      </main>
    </div>
  )
}
