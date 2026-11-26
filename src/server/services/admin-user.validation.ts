import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@/server/auth/password'
import { ValidationError } from '@/server/errors'
import type { AdminUserRole } from '@/types/admin'

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,100}$/
export const MAX_DISPLAY_NAME_LENGTH = 150
export const DEFAULT_AUDIT_LIMIT = 100
export const MAX_AUDIT_LIMIT = 200

const CREATE_FIELDS = new Set([
  'username',
  'display_name',
  'password',
  'confirm_password',
  'role',
])
const UPDATE_FIELDS = new Set([
  'display_name',
  'role',
  'is_active',
  'password',
  'confirm_password',
])

export interface ParsedAdminUserCreateInput {
  username: string
  displayName: string | null
  role: AdminUserRole
  password: string
}

export interface ParsedAdminUserUpdateInput {
  displayName?: string | null
  role?: AdminUserRole
  isActive?: boolean
  password?: string
}

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function rejectUnknownFields(body: Record<string, unknown>, allowed: Set<string>): void {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new ValidationError(`Unknown field: ${key}`)
    }
  }
}

export function normalizeAdminRole(value: unknown): AdminUserRole | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/-/g, '_')
  if (normalized === 'admin') return 'admin'
  if (normalized === 'superadmin' || normalized === 'super_admin') return 'superadmin'
  return null
}

function parseUsername(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Username is required')
  }
  const username = value.trim()
  if (!USERNAME_PATTERN.test(username)) {
    throw new ValidationError(
      'Username must be 3-100 characters and use only letters, numbers, dot, dash, or underscore'
    )
  }
  return username
}

function parseDisplayName(value: unknown, required: boolean): string | null | undefined {
  if (value === undefined) {
    if (required) return null
    return undefined
  }
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ValidationError('Display name must be text')
  }
  const trimmed = value.trim()
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new ValidationError(
      `Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`
    )
  }
  return trimmed || null
}

function parsePassword(value: unknown, required: boolean): string | undefined {
  if (value === undefined) {
    if (required) throw new ValidationError('Password is required')
    return undefined
  }
  if (typeof value !== 'string') {
    throw new ValidationError('Password must be text')
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    )
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters`
    )
  }
  return value
}

function assertConfirmation(
  body: Record<string, unknown>,
  password: string | undefined
): void {
  if (!hasOwn(body, 'confirm_password')) return

  if (password === undefined) {
    throw new ValidationError('Confirm password requires a password')
  }
  if (typeof body.confirm_password !== 'string' || body.confirm_password !== password) {
    throw new ValidationError('Passwords do not match')
  }
}

export function parseAdminUserCreateInput(
  body: Record<string, unknown>
): ParsedAdminUserCreateInput {
  rejectUnknownFields(body, CREATE_FIELDS)

  const username = parseUsername(body.username)
  const password = parsePassword(body.password, true) as string
  assertConfirmation(body, password)
  const displayName = parseDisplayName(body.display_name, true) ?? null

  let role: AdminUserRole = 'admin'
  if (hasOwn(body, 'role')) {
    const normalized = normalizeAdminRole(body.role)
    if (!normalized) throw new ValidationError('Role must be ADMIN or SUPER_ADMIN')
    role = normalized
  }

  return { username, displayName, role, password }
}

export function parseAdminUserUpdateInput(
  body: Record<string, unknown>
): ParsedAdminUserUpdateInput {
  rejectUnknownFields(body, UPDATE_FIELDS)

  const hasDisplayName = hasOwn(body, 'display_name')
  const hasRole = hasOwn(body, 'role')
  const hasActive = hasOwn(body, 'is_active')
  const hasPassword = hasOwn(body, 'password')

  if (!hasDisplayName && !hasRole && !hasActive && !hasPassword) {
    throw new ValidationError('Provide display_name, role, is_active, and/or password')
  }

  const input: ParsedAdminUserUpdateInput = {}

  if (hasDisplayName) {
    input.displayName = parseDisplayName(body.display_name, false)
  }

  if (hasRole) {
    const role = normalizeAdminRole(body.role)
    if (!role) throw new ValidationError('Role must be ADMIN or SUPER_ADMIN')
    input.role = role
  }

  if (hasActive) {
    if (typeof body.is_active !== 'boolean') {
      throw new ValidationError('is_active must be true or false')
    }
    input.isActive = body.is_active
  }

  if (hasPassword) {
    input.password = parsePassword(body.password, true)
  }

  assertConfirmation(body, input.password)

  return input
}

export function isValidAdminId(id: string): boolean {
  return /^[1-9][0-9]{0,19}$/.test(id)
}

export function parseAuditLimit(value: unknown): number {
  if (value === null || value === undefined || value === '') return DEFAULT_AUDIT_LIMIT
  if (typeof value !== 'string') {
    throw new ValidationError(`limit must be an integer between 1 and ${MAX_AUDIT_LIMIT}`)
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_AUDIT_LIMIT) {
    throw new ValidationError(`limit must be an integer between 1 and ${MAX_AUDIT_LIMIT}`)
  }
  return parsed
}
