import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Create a Supabase admin client that bypasses RLS
 * Use ONLY for server-to-server operations (webhooks, cron jobs, etc.)
 * Never expose to client-side code
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
