import type { ServiceRepository } from './service.repository'
import { MySqlServiceRepository } from './mysql-services'
import { ServiceAdminService } from './service.service'

export type {
  ServiceRepository,
  ServiceUpdateAudit,
  ServiceUpdateInput,
} from './service.repository'
export { ServiceAdminService } from './service.service'
export { parseServiceUpdateInput, isValidServiceId } from './service.validation'
export type { AdminService, ServiceUpdatePayload } from '@/types/service'

let cachedRepository: ServiceRepository | null = null

export function getServiceRepository(): ServiceRepository {
  if (!cachedRepository) {
    cachedRepository = new MySqlServiceRepository()
  }
  return cachedRepository
}

export function getServiceAdminService(): ServiceAdminService {
  return new ServiceAdminService(getServiceRepository())
}
