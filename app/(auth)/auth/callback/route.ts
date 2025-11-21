import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // Validate redirect origin to prevent open redirect attacks
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000', // Development
  ].filter(Boolean)

  const requestOrigin = requestUrl.origin
  if (!allowedOrigins.includes(requestOrigin)) {
    console.error('Invalid redirect origin:', requestOrigin)
    return NextResponse.redirect(new URL('/?error=invalid_origin', process.env.NEXT_PUBLIC_APP_URL || requestOrigin))
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error exchanging code for session:', error)
      } else {
        console.error('Auth exchange failed')
      }
      return NextResponse.redirect(`${requestOrigin}/?error=auth_failed`)
    }

    // Update profile avatar (database trigger creates profile with temp handle)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Only update avatar_url - wizard will set the real handle
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: user.user_metadata?.avatar_url })
        .eq('id', user.id)

      if (profileError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error updating profile avatar:', profileError)
        } else {
          console.error('Profile update failed')
        }
      }

      // Check onboarding status to determine redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()

      if (profile?.onboarding_completed) {
        return NextResponse.redirect(`${requestOrigin}/dashboard`)
      }
    }
  }

  // Redirect to wizard for new users or if no user found
  return NextResponse.redirect(`${requestOrigin}/wizard`)
}
