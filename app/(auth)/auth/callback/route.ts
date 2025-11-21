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

    // Update profile avatar (database trigger creates profile with temp handle)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Only update avatar_url - wizard will set the real handle
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: user.user_metadata?.avatar_url })
        .eq('id', user.id)

      if (profileError) {
        console.error('Error updating profile avatar:', profileError)
      }
    }
  }

  // Redirect to wizard (handles upload claiming if needed)
  return NextResponse.redirect(`${origin}/wizard`)
}
