import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, CheckCircle2, FileText } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch most recent resume
  const { data: resume } = await supabase
    .from('resumes')
    .select('id, status, error_message, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch site data if available
  const { data: siteData } = await supabase
    .from('site_data')
    .select('id, content')
    .eq('user_id', user.id)
    .single()

  // Determine resume state
  const hasResume = !!resume
  const hasPublishedSite = !!siteData

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Email:</span> {user.email}
            </p>
            {profile?.handle && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Handle:</span>{' '}
                <Link
                  href={`/${profile.handle}`}
                  className="text-blue-600 hover:underline"
                >
                  webresume.now/{profile.handle}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Resume Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Resume Status</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasResume && (
              <div className="text-center py-8 space-y-4">
                <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                <div className="space-y-2">
                  <p className="text-gray-600">No resume uploaded yet</p>
                  <p className="text-sm text-gray-500">
                    Upload your resume PDF to get started
                  </p>
                </div>
                <Button asChild className="mt-4">
                  <Link href="/">Upload Resume</Link>
                </Button>
              </div>
            )}

            {hasResume && resume.status === 'processing' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium">Your resume is being analyzed...</p>
                    <p className="text-sm text-gray-500">
                      This usually takes 30-40 seconds
                    </p>
                  </div>
                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                    Processing
                  </Badge>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/waiting?resume_id=${resume.id}`}>
                    View Progress
                  </Link>
                </Button>
              </div>
            )}

            {hasResume && resume.status === 'failed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">Processing failed</p>
                    <p className="text-sm text-red-700">
                      {resume.error_message || 'Unknown error occurred'}
                    </p>
                  </div>
                  <Badge variant="destructive">Failed</Badge>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="default" className="flex-1">
                    <Link href={`/waiting?resume_id=${resume.id}`}>
                      Try Again
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/">Upload New Resume</Link>
                  </Button>
                </div>
              </div>
            )}

            {hasResume && resume.status === 'completed' && hasPublishedSite && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Resume published!</p>
                    <p className="text-sm text-gray-500">
                      Your web resume is live and ready to share
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    Published
                  </Badge>
                </div>
                {profile?.handle && (
                  <Button asChild className="w-full">
                    <Link href={`/${profile.handle}`}>
                      View Your Resume
                    </Link>
                  </Button>
                )}
              </div>
            )}

            {hasResume && resume.status === 'pending_claim' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                  <div className="flex-1">
                    <p className="font-medium">Claiming your resume...</p>
                    <p className="text-sm text-gray-500">Please wait</p>
                  </div>
                  <Badge variant="default" className="bg-gray-100 text-gray-800">
                    Pending
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        {hasPublishedSite && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/edit">Edit Resume Content</Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/settings">Privacy Settings</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
