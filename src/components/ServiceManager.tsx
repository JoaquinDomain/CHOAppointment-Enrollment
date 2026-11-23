'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, RefreshCw, Save, XCircle } from 'lucide-react'
import type { AdminService } from '@/types/service'

interface ServiceManagerProps {
  adminFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  onClose: () => void
}

interface ServiceDraft {
  daily_capacity: string
  is_active: boolean
}

const MAX_DAILY_CAPACITY = 100_000

function draftFromService(service: AdminService): ServiceDraft {
  return {
    daily_capacity: String(service.daily_capacity),
    is_active: service.is_active,
  }
}

function isDraftDirty(service: AdminService, draft: ServiceDraft): boolean {
  return (
    Number(draft.daily_capacity) !== service.daily_capacity ||
    draft.is_active !== service.is_active
  )
}

export default function ServiceManager({ adminFetch, onClose }: ServiceManagerProps) {
  const [services, setServices] = useState<AdminService[]>([])
  const [drafts, setDrafts] = useState<Record<string, ServiceDraft>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    const loadServices = async () => {
      try {
        const response = await adminFetch('/api/admin/services', {
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load services')
        }
        const list = (payload?.services ?? []) as AdminService[]
        setServices(list)
        setDrafts(
          Object.fromEntries(list.map(service => [service.id, draftFromService(service)]))
        )
        setError(null)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load services')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadServices()

    return () => controller.abort()
  }, [adminFetch, reloadKey])

  const handleRefresh = () => {
    setLoading(true)
    setError(null)
    setSavedId(null)
    setReloadKey(key => key + 1)
  }

  const updateDraft = (id: string, patch: Partial<ServiceDraft>) => {
    setSavedId(null)
    setDrafts(previous => ({
      ...previous,
      [id]: { ...previous[id], ...patch },
    }))
  }

  const handleSave = async (service: AdminService) => {
    const draft = drafts[service.id]
    if (!draft || savingId) return

    const capacity = Number(draft.daily_capacity)
    if (
      draft.daily_capacity.trim() === '' ||
      !Number.isInteger(capacity) ||
      capacity < 0 ||
      capacity > MAX_DAILY_CAPACITY
    ) {
      setError(`Daily limit must be a whole number between 0 and ${MAX_DAILY_CAPACITY}.`)
      return
    }

    setSavingId(service.id)
    setSavedId(null)
    setError(null)
    try {
      const response = await adminFetch(`/api/admin/services/${encodeURIComponent(service.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_capacity: capacity,
          is_active: draft.is_active,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update service')
      }
      const updated = payload.service as AdminService
      setServices(previous =>
        previous.map(item => (item.id === updated.id ? updated : item))
      )
      setDrafts(previous => ({
        ...previous,
        [updated.id]: draftFromService(updated),
      }))
      setSavedId(updated.id)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update service')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Manage services</h2>
          <p className="text-xs font-medium text-slate-500">
            Turn a service on or off and set its daily booking limit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading || savingId !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            aria-label="Close service manager"
          >
            <XCircle className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span
              className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
              aria-hidden
            />
            <p className="text-sm font-semibold text-slate-600">Loading services…</p>
          </div>
        ) : services.length === 0 ? (
          <p className="p-10 text-center text-sm font-semibold text-slate-600">
            No services found.
          </p>
        ) : (
          <div className="space-y-3">
            {services.map(service => {
              const draft = drafts[service.id] ?? draftFromService(service)
              const dirty = isDraftDirty(service, draft)
              const saving = savingId === service.id
              const saved = savedId === service.id

              return (
                <div
                  key={service.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{service.name}</h3>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${
                            draft.is_active
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-slate-100 text-slate-600 ring-slate-200'
                          }`}
                        >
                          {draft.is_active ? 'Available' : 'Unavailable'}
                        </span>
                        {service.external_url && (
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-200">
                            External link
                          </span>
                        )}
                      </div>
                      {service.description && (
                        <p className="mt-0.5 text-xs text-slate-500">{service.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label
                          htmlFor={`capacity-${service.id}`}
                          className="block text-[11px] font-bold uppercase tracking-wide text-slate-500"
                        >
                          Daily limit
                        </label>
                        <input
                          id={`capacity-${service.id}`}
                          type="number"
                          min={0}
                          max={MAX_DAILY_CAPACITY}
                          step={1}
                          value={draft.daily_capacity}
                          onChange={event =>
                            updateDraft(service.id, { daily_capacity: event.target.value })
                          }
                          disabled={saving}
                          className="cho-input mt-1 w-28"
                        />
                      </div>

                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          Availability
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.is_active}
                          aria-label={`${service.name} availability`}
                          onClick={() => updateDraft(service.id, { is_active: !draft.is_active })}
                          disabled={saving}
                          className={`mt-1 inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                            draft.is_active
                              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          } disabled:opacity-60`}
                        >
                          <span
                            aria-hidden
                            className={`h-2.5 w-2.5 rounded-full ${
                              draft.is_active ? 'bg-emerald-200' : 'bg-slate-500'
                            }`}
                          />
                          {draft.is_active ? 'On' : 'Off'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSave(service)}
                        disabled={!dirty || saving}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving ? (
                          <span
                            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                            aria-hidden
                          />
                        ) : saved ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
