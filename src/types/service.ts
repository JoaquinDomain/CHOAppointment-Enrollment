export interface AdminService {
  id: string
  name: string
  description: string | null
  daily_capacity: number
  requires_time_slot: boolean
  is_active: boolean
  external_url: string | null
}

export interface ServiceUpdatePayload {
  daily_capacity?: number
  is_active?: boolean
}
