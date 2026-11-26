import type { AdminUserRepository } from './admin-user.repository'
import { MySqlAdminUserRepository } from './mysql-admin-users'
import { AdminUserService } from './admin-user.service'
import type { ServiceRepository } from './service.repository'
import { MySqlServiceRepository } from './mysql-services'
import { ServiceAdminService } from './service.service'

export type {
  ServiceRepository,
  ServiceUpdateAudit,
  ServiceUpdateInput,
} from './service.repository'
export type {
  AdminUserAuditContext,
  AdminUserCreateInput,
  AdminUserRepository,
  AdminUserUpdateInput,
} from './admin-user.repository'
export { AdminUserService } from './admin-user.service'
export {
  normalizeAdminRole,
  parseAdminUserCreateInput,
  parseAdminUserUpdateInput,
  parseAuditLimit,
  isValidAdminId,
} from './admin-user.validation'
export { ServiceAdminService } from './service.service'
export { parseServiceUpdateInput, isValidServiceId } from './service.validation'
export type {
  AdminAuditEntry,
  AdminUser,
  AdminUserRole,
} from '@/types/admin'
export type { AdminService, ServiceUpdatePayload } from '@/types/service'

let cachedRepository: ServiceRepository | null = null
let cachedAdminUserRepository: AdminUserRepository | null = null

export function getServiceRepository(): ServiceRepository {
  if (!cachedRepository) {
    cachedRepository = new MySqlServiceRepository()
  }
  return cachedRepository
}

export function getServiceAdminService(): ServiceAdminService {
  return new ServiceAdminService(getServiceRepository())
}

export function getAdminUserRepository(): AdminUserRepository {
  if (!cachedAdminUserRepository) {
    cachedAdminUserRepository = new MySqlAdminUserRepository()
  }
  return cachedAdminUserRepository
}

export function getAdminUserService(): AdminUserService {
  return new AdminUserService(getAdminUserRepository())
}
