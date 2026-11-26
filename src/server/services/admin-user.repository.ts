import type { AdminAuditEntry, AdminUser, AdminUserRole } from '@/types/admin'

export interface AdminUserAuditContext {
  adminId: number
  username: string
  ip: string
  userAgent: string
  requestId: string
}

export interface AdminUserCreateInput {
  username: string
  displayName: string | null
  role: AdminUserRole
  passwordHash: string
}

export interface AdminUserUpdateInput {
  displayName?: string | null
  role?: AdminUserRole
  isActive?: boolean
  passwordHash?: string
}

export interface AdminUserRepository {
  list(): Promise<AdminUser[]>
  countActiveSuperAdmins(): Promise<number>
  create(input: AdminUserCreateInput, audit: AdminUserAuditContext): Promise<AdminUser>
  update(id: string, input: AdminUserUpdateInput, audit: AdminUserAuditContext): Promise<AdminUser>
  listAudit(limit: number): Promise<AdminAuditEntry[]>
}
