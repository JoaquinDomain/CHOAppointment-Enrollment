import { hashPassword } from '@/server/auth/password'
import { NotFoundError } from '@/server/errors'
import type { AdminAuditEntry, AdminUser } from '@/types/admin'
import type {
  AdminUserAuditContext,
  AdminUserRepository,
} from './admin-user.repository'
import {
  isValidAdminId,
  parseAdminUserCreateInput,
  parseAdminUserUpdateInput,
  parseAuditLimit,
} from './admin-user.validation'

export class AdminUserService {
  constructor(private readonly repository: AdminUserRepository) {}

  list(): Promise<AdminUser[]> {
    return this.repository.list()
  }

  countActiveSuperAdmins(): Promise<number> {
    return this.repository.countActiveSuperAdmins()
  }

  async create(
    body: Record<string, unknown>,
    audit: AdminUserAuditContext
  ): Promise<AdminUser> {
    const input = parseAdminUserCreateInput(body)
    const passwordHash = await hashPassword(input.password)
    return this.repository.create(
      {
        username: input.username,
        displayName: input.displayName,
        role: input.role,
        passwordHash,
      },
      audit
    )
  }

  async update(
    id: string,
    body: Record<string, unknown>,
    audit: AdminUserAuditContext
  ): Promise<AdminUser> {
    if (!isValidAdminId(id)) {
      throw new NotFoundError('Administrator not found')
    }

    const input = parseAdminUserUpdateInput(body)
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : undefined

    return this.repository.update(
      id,
      {
        displayName: input.displayName,
        role: input.role,
        isActive: input.isActive,
        passwordHash,
      },
      audit
    )
  }

  listAudit(limit: unknown): Promise<AdminAuditEntry[]> {
    return this.repository.listAudit(parseAuditLimit(limit))
  }
}
