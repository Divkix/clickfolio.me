import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'
import { ENV } from '../env'

export function createClient() {
  return createBrowserClient<Database>(ENV.SUPABASE_URL(), ENV.SUPABASE_ANON_KEY())
}
