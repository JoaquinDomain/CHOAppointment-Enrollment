import { ValidationError } from '@/server/errors'
import type { ServiceUpdateInput } from './service.repository'

export const MAX_DAILY_CAPACITY = 100_000

export function parseServiceUpdateInput(body: Record<string, unknown>): ServiceUpdateInput {
  const hasCapacity = Object.prototype.hasOwnProperty.call(body, 'daily_capacity')
  const hasActive = Object.prototype.hasOwnProperty.call(body, 'is_active')

  if (!hasCapacity && !hasActive) {
    throw new ValidationError('Provide daily_capacity and/or is_active')
  }

  const input: ServiceUpdateInput = {}

  if (hasCapacity) {
    const capacity = body.daily_capacity
    if (
      typeof capacity !== 'number' ||
      !Number.isInteger(capacity) ||
      capacity < 0 ||
      capacity > MAX_DAILY_CAPACITY
    ) {
      throw new ValidationError(
        `daily_capacity must be a whole number between 0 and ${MAX_DAILY_CAPACITY}`
      )
    }
    input.dailyCapacity = capacity
  }

  if (hasActive) {
    if (typeof body.is_active !== 'boolean') {
      throw new ValidationError('is_active must be true or false')
    }
    input.isActive = body.is_active
  }

  return input
}

export function isValidServiceId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(id)
}
