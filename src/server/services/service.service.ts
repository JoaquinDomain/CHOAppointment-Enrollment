import type { AdminService } from '@/types/service'
import type {
  ServiceRepository,
  ServiceUpdateAudit,
} from './service.repository'
import { parseServiceUpdateInput } from './service.validation'

export class ServiceAdminService {
  constructor(private readonly repository: ServiceRepository) {}

  list(): Promise<AdminService[]> {
    return this.repository.listForAdmin()
  }

  update(
    id: string,
    body: Record<string, unknown>,
    audit: ServiceUpdateAudit
  ): Promise<AdminService> {
    const input = parseServiceUpdateInput(body)
    return this.repository.update(id, input, audit)
  }
}
