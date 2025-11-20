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
      // Generate unique handle from email
      const baseHandle = user.email!
        .split('@')[0]
        .replace(/[^a-z0-9]/gi, '-') // Use dash instead of removing
        .toLowerCase()
        .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
        .replace(/-+/g, '-') // Collapse multiple dashes
        .slice(0, 20) // Shorter base to leave room for suffix

      // Check for uniqueness and add random suffix if needed
      let finalHandle = baseHandle
      let attempts = 0
      const maxAttempts = 5

      while (attempts < maxAttempts) {
        // Check if handle exists
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('handle', finalHandle)
          .maybeSingle()

        if (!existing) {
          // Handle is available
          break
        }

        // Handle exists, add random suffix
        const randomSuffix = Math.random().toString(36).substring(2, 6) // 4 chars
        finalHandle = `${baseHandle}-${randomSuffix}`
        attempts++
      }

      // Final fallback if all attempts failed
      if (attempts >= maxAttempts) {
        finalHandle = `user-${user.id.substring(0, 12)}`
      }

      // Check if profile already has a handle set
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('handle')
        .eq('id', user.id)
        .maybeSingle()

      if (existingProfile?.handle) {
        // Profile exists with handle - preserve it, only update avatar
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ avatar_url: user.user_metadata?.avatar_url })
          .eq('id', user.id)

        if (profileError) {
          console.error('Error updating profile avatar:', profileError)
        }
      } else {
        // No handle set yet - safe to upsert with auto-generated handle
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email!,
          avatar_url: user.user_metadata?.avatar_url,
          handle: finalHandle
        }, { onConflict: 'id' })

        if (profileError) {
          console.error('Error creating profile:', profileError)
          // Don't fail the auth flow - trigger should have handled it
        }
      }
    }
  }

  // Check for pending upload in onboarding
  return NextResponse.redirect(`${origin}/onboarding`)
}
