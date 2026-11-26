export type AdminUserRole = 'admin' | 'superadmin'

export interface AdminUser {
  id: number
  username: string
  display_name: string | null
  role: AdminUserRole
  is_active: boolean
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface AdminAuditEntry {
  id: number
  actor_type: 'admin' | 'patient' | 'system'
  actor_id: number | null
  actor_username: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AdminUserCreatePayload {
  username: string
  display_name?: string | null
  password: string
  confirm_password?: string
  role?: AdminUserRole | 'ADMIN' | 'SUPER_ADMIN'
}

export interface AdminUserUpdatePayload {
  display_name?: string | null
  role?: AdminUserRole | 'ADMIN' | 'SUPER_ADMIN'
  is_active?: boolean
  password?: string
  confirm_password?: string
}
