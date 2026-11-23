import type { AdminService } from '@/types/service'

export interface ServiceUpdateInput {
  dailyCapacity?: number
  isActive?: boolean
}

export interface ServiceUpdateAudit {
  adminId: number
  adminUsername: string
  ip: string
  userAgent: string
  requestId: string
}

export interface ServiceRepository {
  listForAdmin(): Promise<AdminService[]>
  update(
    id: string,
    input: ServiceUpdateInput,
    audit: ServiceUpdateAudit
  ): Promise<AdminService>
}
