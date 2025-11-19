import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }

    // Defensive fallback: ensure profile exists even if trigger fails
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email!,
        avatar_url: user.user_metadata?.avatar_url,
        handle: user.email!.substring(0, 12).replace(/[^a-z0-9]/gi, '').toLowerCase() || user.id.substring(0, 12)
      }, { onConflict: 'id' })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Don't fail the auth flow - trigger should have handled it
      }
    }
  }

  // Check for pending upload in onboarding
  return NextResponse.redirect(`${origin}/onboarding`)
}
