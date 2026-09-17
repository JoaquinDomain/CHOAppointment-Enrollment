// Central server-only environment access for the backend.

export type DbProvider = 'supabase' | 'oracle'

export function getDbProvider(): DbProvider {
  return process.env.DB_PROVIDER === 'oracle' ? 'oracle' : 'supabase'
}

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key',
  }
}

export interface OracleEnvConfig {
  user: string
  password: string
  connectString: string
  poolMin: number
  poolMax: number
  clientLibDir?: string
}

export function getOracleEnv(): OracleEnvConfig | null {
  const user = process.env.ORACLE_USER
  const password = process.env.ORACLE_PASSWORD
  const connectString = process.env.ORACLE_CONNECT_STRING
  if (!user || !password || !connectString) return null

  return {
    user,
    password,
    connectString,
    poolMin: Number(process.env.ORACLE_POOL_MIN || 1),
    poolMax: Number(process.env.ORACLE_POOL_MAX || 4),
    clientLibDir: process.env.ORACLE_CLIENT_LIB_DIR,
  }
}
