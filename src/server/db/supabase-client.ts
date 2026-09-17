// Server-only Supabase client factory.
// Lazy creation avoids build-time failures when env is missing.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '@/server/config/env'

export function getSupabaseClient(): SupabaseClient {
  const { url, key } = getSupabaseEnv()
  return createClient(url, key)
}
