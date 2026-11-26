'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  KeyRound,
  Power,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import type { AdminAuditEntry, AdminUser, AdminUserRole } from '@/types/admin'

interface AdminUsersManagerProps {
  currentAdminId: number
  currentAdminUsername: string
}

interface CreateDraft {
  username: string
  display_name: string
  password: string
  confirm_password: string
  role: AdminUserRole
}

interface EditDraft {
  display_name: string
  role: AdminUserRole
  is_active: boolean
  password: string
  confirm_password: string
}

interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  destructive: boolean
  run: () => void
}

const EMPTY_CREATE: CreateDraft = {
  username: '',
  display_name: '',
  password: '',
  confirm_password: '',
  role: 'admin',
}

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,100}$/
const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 200
const MAX_DISPLAY_NAME_LENGTH = 150

const ROLE_LABELS: Record<AdminUserRole, string> = {
  admin: 'ADMIN',
  superadmin: 'SUPER_ADMIN',
}

const ACTION_LABELS: Record<string, string> = {
  'admin.user.created': 'Administrator created',
  'admin.user.updated': 'Details updated',
  'admin.user.password_reset': 'Password reset',
  'admin.user.activated': 'Account activated',
  'admin.user.deactivated': 'Account deactivated',
  'admin.user.role_changed': 'Role changed',
  'admin.user.bootstrap_promoted': 'Bootstrapped to Super Admin',
  'administrator.provisioned': 'Provisioned by CLI',
}

function readCookieValue(name: string): string | null {
  const prefix = `${name}=`
  const row = document.cookie.split('; ').find(item => item.startsWith(prefix))
  return row ? decodeURIComponent(row.slice(prefix.length)) : null
}

function getCsrfToken(): string | null {
  return readCookieValue('__Host-cho_csrf') ?? readCookieValue('cho_csrf')
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  const parsed = new Date(`${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function roleBadge(role: AdminUserRole): string {
  return role === 'superadmin'
    ? 'bg-blue-100 text-blue-800 ring-blue-200'
    : 'bg-slate-100 text-slate-700 ring-slate-200'
}

function statusBadge(isActive: boolean): string {
  return isActive
    ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
    : 'bg-red-100 text-red-800 ring-red-200'
}

function describeTarget(entry: AdminAuditEntry): string {
  const target = entry.metadata?.target_username
  if (typeof target === 'string' && target) return target
  return entry.entity_id ?? '—'
}

function describeMetadata(entry: AdminAuditEntry): string {
  const metadata = entry.metadata ?? {}
  if (entry.action === 'admin.user.role_changed') {
    return `${String(metadata.previous_role ?? '—')} → ${String(metadata.new_role ?? '—')}`
  }
  if (
    entry.action === 'admin.user.activated' ||
    entry.action === 'admin.user.deactivated'
  ) {
    return `Active: ${String(metadata.previous_is_active ?? '—')} → ${String(
      metadata.is_active ?? '—'
    )}`
  }
  if (entry.action === 'admin.user.updated') {
    return `Display name: ${String(metadata.previous_display_name ?? '—')} → ${String(
      metadata.display_name ?? '—'
    )}`
  }
  if (entry.action === 'admin.user.created' || entry.action === 'administrator.provisioned') {
    return `Role: ${String(metadata.role ?? '—')}`
  }
  if (entry.action === 'admin.user.bootstrap_promoted') {
    return `${String(metadata.previous_role ?? 'admin')} → ${String(
      metadata.new_role ?? 'superadmin'
    )}`
  }
  if (entry.action === 'admin.user.password_reset') {
    return 'Sign-in credentials replaced'
  }
  return ''
}

function draftFromUser(user: AdminUser): EditDraft {
  return {
    display_name: user.display_name ?? '',
    role: user.role,
    is_active: user.is_active,
    password: '',
    confirm_password: '',
  }
}

export default function AdminUsersManager({
  currentAdminId,
  currentAdminUsername,
}: AdminUsersManagerProps) {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [logs, setLogs] = useState<AdminAuditEntry[]>([])
  const [activeSuperadminCount, setActiveSuperadminCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [showCreate, setShowCreate] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({
    display_name: '',
    role: 'admin',
    is_active: true,
    password: '',
    confirm_password: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const adminFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      const method = (init.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') {
        const csrfToken = getCsrfToken()
        if (csrfToken) headers.set('x-csrf-token', csrfToken)
      }
      const response = await fetch(input, {
        ...init,
        headers,
        credentials: 'same-origin',
      })
      if (response.status === 401) {
        router.replace('/admin/login')
      }
      return response
    },
    [router]
  )

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const [usersResponse, auditResponse] = await Promise.all([
          adminFetch('/api/admin/users', { signal: controller.signal }),
          adminFetch('/api/admin/audit-logs?limit=100', { signal: controller.signal }),
        ])

        const usersPayload = await usersResponse.json().catch(() => null)
        if (!usersResponse.ok) {
          throw new Error(usersPayload?.error || 'Failed to load administrators')
        }

        const auditPayload = await auditResponse.json().catch(() => null)
        if (!auditResponse.ok) {
          throw new Error(auditPayload?.error || 'Failed to load the audit log')
        }

        setUsers(Array.isArray(usersPayload?.users) ? usersPayload.users : [])
        setActiveSuperadminCount(Number(usersPayload?.active_superadmin_count ?? 0))
        setLogs(Array.isArray(auditPayload?.logs) ? auditPayload.logs : [])
        setError(null)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load administrator data'
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [adminFetch, reloadKey])

  const reload = () => {
    setLoading(true)
    setReloadKey(key => key + 1)
  }

  const validatePassword = (password: string, confirmation: string): string | null => {
    if (!password) return 'Password is required'
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`
    }
    if (password !== confirmation) return 'Passwords do not match'
    return null
  }

  const performCreate = async () => {
    if (creating) return
    const username = createDraft.username.trim()

    setCreating(true)
    setCreateError(null)
    try {
      const response = await adminFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          display_name: createDraft.display_name.trim() || null,
          password: createDraft.password,
          confirm_password: createDraft.confirm_password,
          role: createDraft.role,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create administrator')
      }
      setShowCreate(false)
      setCreateDraft(EMPTY_CREATE)
      setNotice(`Administrator "${username}" was created.`)
      reload()
    } catch (createFailure) {
      setCreateError(
        createFailure instanceof Error ? createFailure.message : 'Failed to create administrator'
      )
    } finally {
      setCreating(false)
    }
  }

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault()
    if (creating) return
    setCreateError(null)

    const username = createDraft.username.trim()
    if (!USERNAME_PATTERN.test(username)) {
      setCreateError(
        'Username must be 3-100 characters and use only letters, numbers, dot, dash, or underscore'
      )
      return
    }
    if (createDraft.display_name.trim().length > MAX_DISPLAY_NAME_LENGTH) {
      setCreateError(`Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`)
      return
    }
    const passwordError = validatePassword(createDraft.password, createDraft.confirm_password)
    if (passwordError) {
      setCreateError(passwordError)
      return
    }

    if (createDraft.role === 'superadmin') {
      setConfirmState({
        title: 'Create a super administrator',
        message: `"${username}" will receive full SUPER_ADMIN access, including administrator management. Continue?`,
        confirmLabel: 'Create SUPER_ADMIN',
        destructive: false,
        run: () => void performCreate(),
      })
      return
    }

    void performCreate()
  }

  const openEditor = (user: AdminUser) => {
    setEditing(user)
    setEditDraft(draftFromUser(user))
    setEditError(null)
  }

  const closeEditor = () => {
    if (saving) return
    setEditing(null)
    setEditError(null)
  }

  const performUpdate = async (payload: Record<string, unknown>, successMessage: string) => {
    if (!editing) return
    setSaving(true)
    setEditError(null)
    try {
      const response = await adminFetch(`/api/admin/users/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to update administrator')
      }
      const updated = body?.user as AdminUser
      setUsers(previous =>
        previous.map(user => (user.id === updated.id ? updated : user))
      )
      setEditing(null)
      if (updated.id === currentAdminId && updated.role !== 'superadmin') {
        router.replace('/admin')
        router.refresh()
        return
      }
      setNotice(successMessage)
      reload()
    } catch (updateFailure) {
      setEditError(
        updateFailure instanceof Error
          ? updateFailure.message
          : 'Failed to update administrator'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing || saving) return
    setEditError(null)

    if (editDraft.display_name.trim().length > MAX_DISPLAY_NAME_LENGTH) {
      setEditError(`Display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`)
      return
    }

    const passwordChanged = editDraft.password.length > 0
    if (passwordChanged) {
      const passwordError = validatePassword(
        editDraft.password,
        editDraft.confirm_password
      )
      if (passwordError) {
        setEditError(passwordError)
        return
      }
    }

    const roleChanged = editDraft.role !== editing.role
    const statusChanged = editDraft.is_active !== editing.is_active

    const payload: Record<string, unknown> = {
      display_name: editDraft.display_name.trim() || null,
      role: editDraft.role,
      is_active: editDraft.is_active,
    }
    if (passwordChanged) {
      payload.password = editDraft.password
      payload.confirm_password = editDraft.confirm_password
    }

    let successMessage = `Administrator "${editing.username}" was updated.`
    if (passwordChanged) successMessage = `Password reset for "${editing.username}".`

    if (!roleChanged && !statusChanged && !passwordChanged) {
      void performUpdate(payload, successMessage)
      return
    }

    const messages: string[] = []
    if (roleChanged) {
      messages.push(
        `change the role from ${ROLE_LABELS[editing.role]} to ${ROLE_LABELS[editDraft.role]}`
      )
    }
    if (statusChanged) {
      messages.push(editDraft.is_active ? 'activate the account' : 'deactivate the account')
    }
    if (passwordChanged) messages.push('reset the password and revoke existing sessions')

    const selfWarning =
      editing.id === currentAdminId && roleChanged && editDraft.role === 'admin'
        ? ' You will lose access to Admin Management immediately.'
        : ''

    setConfirmState({
      title: 'Confirm administrator change',
      message: `You are about to ${messages.join(', ')} for "${editing.username}".${selfWarning}`,
      confirmLabel: 'Apply change',
      destructive: !editDraft.is_active || (roleChanged && editDraft.role === 'admin'),
      run: () => void performUpdate(payload, successMessage),
    })
  }

  const activeAdmins = users.filter(user => user.is_active).length

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 text-white shadow-lg shadow-emerald-900/20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-50 ring-1 ring-white/25">
                Super Admin · Access control
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight">Administrator management</h1>
              <p className="text-sm font-medium text-emerald-100">
                Signed in as {currentAdminUsername} · Create accounts, set roles, and review
                administrative activity.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <a
                href="/admin"
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 transition-all hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </a>
              <button
                onClick={reload}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-md transition-all hover:-translate-y-px hover:shadow-lg disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm">
            <span className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              {notice}
            </span>
            <button
              onClick={() => setNotice(null)}
              className="rounded-lg p-1 transition hover:bg-emerald-100"
              aria-label="Dismiss notification"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-3 ring-1 ring-emerald-200/60">
                <Users className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Administrators
                </p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {users.length}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-3 ring-1 ring-blue-200/60">
                <ShieldCheck className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active super admins
                </p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {activeSuperadminCount}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-3 ring-1 ring-green-200/60">
                <Power className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active accounts
                </p>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {activeAdmins}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
                <span className="cho-section-icon">
                  <UserPlus className="h-4 w-4" />
                </span>
                Create administrator
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                New accounts start with the role you choose. Passwords must be at least{' '}
                {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreate(value => !value)
                setCreateError(null)
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700"
            >
              <UserPlus className="h-4 w-4" />
              {showCreate ? 'Close form' : 'New administrator'}
            </button>
          </div>

          {showCreate && (
            <form onSubmit={handleCreate} className="mt-5 border-t border-slate-200 pt-5">
              {createError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="new-username" className="cho-label">
                    Username
                  </label>
                  <input
                    id="new-username"
                    type="text"
                    required
                    maxLength={100}
                    autoComplete="off"
                    value={createDraft.username}
                    onChange={event =>
                      setCreateDraft(previous => ({
                        ...previous,
                        username: event.target.value,
                      }))
                    }
                    className="cho-input"
                    placeholder="e.g. cho.admin2"
                  />
                </div>
                <div>
                  <label htmlFor="new-display-name" className="cho-label">
                    Display name (optional)
                  </label>
                  <input
                    id="new-display-name"
                    type="text"
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    autoComplete="off"
                    value={createDraft.display_name}
                    onChange={event =>
                      setCreateDraft(previous => ({
                        ...previous,
                        display_name: event.target.value,
                      }))
                    }
                    className="cho-input"
                    placeholder="e.g. Maria Santos"
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="cho-label">
                    Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    maxLength={MAX_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    value={createDraft.password}
                    onChange={event =>
                      setCreateDraft(previous => ({
                        ...previous,
                        password: event.target.value,
                      }))
                    }
                    className="cho-input"
                  />
                </div>
                <div>
                  <label htmlFor="new-password-confirm" className="cho-label">
                    Confirm password
                  </label>
                  <input
                    id="new-password-confirm"
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    maxLength={MAX_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    value={createDraft.confirm_password}
                    onChange={event =>
                      setCreateDraft(previous => ({
                        ...previous,
                        confirm_password: event.target.value,
                      }))
                    }
                    className="cho-input"
                  />
                </div>
                <div>
                  <label htmlFor="new-role" className="cho-label">
                    Initial role
                  </label>
                  <select
                    id="new-role"
                    value={createDraft.role}
                    onChange={event =>
                      setCreateDraft(previous => ({
                        ...previous,
                        role: event.target.value as AdminUserRole,
                      }))
                    }
                    className="cho-select"
                  >
                    <option value="admin">ADMIN</option>
                    <option value="superadmin">SUPER_ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false)
                    setCreateDraft(EMPTY_CREATE)
                    setCreateError(null)
                  }}
                  disabled={creating}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {creating && (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden
                    />
                  )}
                  {creating ? 'Creating…' : 'Create administrator'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200/80 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <h2 className="text-base font-extrabold tracking-tight text-slate-900">
              Administrator accounts
            </h2>
            <p className="text-xs font-semibold text-slate-500">{users.length} total</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <span
                className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
                aria-hidden
              />
              <p className="text-sm font-semibold text-slate-600">Loading administrators…</p>
            </div>
          ) : users.length === 0 ? (
            <p className="p-12 text-center text-sm font-semibold text-slate-600">
              No administrator accounts found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80">
                <thead className="bg-slate-50/80">
                  <tr>
                    {['Administrator', 'Role', 'Status', 'Last login', 'Created', ''].map(
                      header => (
                        <th
                          key={header || 'actions'}
                          className="whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {users.map(user => (
                    <tr key={user.id} className="transition-colors hover:bg-emerald-50/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200/60">
                            <ShieldCheck className="h-5 w-5 text-emerald-700" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900">
                              {user.username}
                              {user.id === currentAdminId && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-medium text-slate-500">
                              {user.display_name || 'No display name'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${roleBadge(user.role)}`}
                        >
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusBadge(user.is_active)}`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatDateTime(user.last_login_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatDateTime(user.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <button
                          onClick={() => openEditor(user)}
                          className="font-bold text-emerald-600 hover:text-emerald-800"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200/80 bg-slate-50/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900">
                Administrative audit log
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Account and role activity recorded by the server. Passwords and hashes are never
                recorded.
              </p>
            </div>
            <p className="text-xs font-semibold text-slate-500">{logs.length} recent entries</p>
          </div>

          {logs.length === 0 ? (
            <p className="p-10 text-center text-sm font-semibold text-slate-600">
              No administrative audit entries yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80">
                <thead className="bg-slate-50/80">
                  <tr>
                    {['When', 'Action', 'Actor', 'Target', 'Details'].map(header => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {logs.map(entry => (
                    <tr key={entry.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs font-semibold text-slate-600">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-sm font-bold text-slate-800">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-sm text-slate-600">
                        {entry.actor_username ?? entry.actor_type}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-sm text-slate-600">
                        {describeTarget(entry)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs font-medium text-slate-500">
                        {describeMetadata(entry) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900">
                  <KeyRound className="h-5 w-5 text-emerald-600" />
                  Edit {editing.username}
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  Changes are written to the database immediately and recorded in the audit log.
                </p>
              </div>
              <button
                onClick={closeEditor}
                disabled={saving}
                className="rounded-lg p-2 transition hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close editor"
              >
                <XCircle className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6">
              {editError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="edit-display-name" className="cho-label">
                    Display name
                  </label>
                  <input
                    id="edit-display-name"
                    type="text"
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    value={editDraft.display_name}
                    onChange={event =>
                      setEditDraft(previous => ({
                        ...previous,
                        display_name: event.target.value,
                      }))
                    }
                    className="cho-input"
                  />
                </div>

                <div>
                  <label htmlFor="edit-role" className="cho-label">
                    Role
                  </label>
                  <select
                    id="edit-role"
                    value={editDraft.role}
                    onChange={event =>
                      setEditDraft(previous => ({
                        ...previous,
                        role: event.target.value as AdminUserRole,
                      }))
                    }
                    className="cho-select"
                  >
                    <option value="admin">ADMIN</option>
                    <option value="superadmin">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <span className="cho-label">Account status</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editDraft.is_active}
                    aria-label="Account active"
                    disabled={editing.id === currentAdminId}
                    onClick={() =>
                      setEditDraft(previous => ({
                        ...previous,
                        is_active: !previous.is_active,
                      }))
                    }
                    className={`inline-flex h-[42px] w-full items-center justify-between rounded-xl px-4 text-sm font-bold transition ${
                      editDraft.is_active
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {editDraft.is_active ? 'Active' : 'Inactive'}
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 rounded-full ${
                        editDraft.is_active ? 'bg-emerald-200' : 'bg-slate-500'
                      }`}
                    />
                  </button>
                  {editing.id === currentAdminId && (
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      You cannot deactivate your own account.
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2 border-t border-slate-200 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Password reset
                  </p>
                  <p className="mb-3 text-xs font-medium text-slate-500">
                    Leave both fields empty to keep the current password. Resetting revokes all
                    active sessions for this account.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="edit-password" className="cho-label">
                        New password
                      </label>
                      <input
                        id="edit-password"
                        type="password"
                        minLength={MIN_PASSWORD_LENGTH}
                        maxLength={MAX_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={editDraft.password}
                        onChange={event =>
                          setEditDraft(previous => ({
                            ...previous,
                            password: event.target.value,
                          }))
                        }
                        className="cho-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-password-confirm" className="cho-label">
                        Confirm new password
                      </label>
                      <input
                        id="edit-password-confirm"
                        type="password"
                        minLength={MIN_PASSWORD_LENGTH}
                        maxLength={MAX_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={editDraft.confirm_password}
                        onChange={event =>
                          setEditDraft(previous => ({
                            ...previous,
                            confirm_password: event.target.value,
                          }))
                        }
                        className="cho-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving && (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden
                    />
                  )}
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                  confirmState.destructive
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <h3 className="text-base font-extrabold tracking-tight text-slate-900">
                {confirmState.title}
              </h3>
            </div>
            <p className="text-sm font-medium leading-relaxed text-slate-600">
              {confirmState.message}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmState(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const run = confirmState.run
                  setConfirmState(null)
                  run()
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition ${
                  confirmState.destructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
