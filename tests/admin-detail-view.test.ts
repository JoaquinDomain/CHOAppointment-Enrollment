/**
 * @vitest-environment jsdom
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => {
  const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }
  return { useRouter: () => router }
})

vi.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: class {
    render() {}
    clear() {}
  },
}))

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => null,
}))

import AdminDashboard from '@/components/AdminDashboard'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const LIST_ROW = {
  id: '1',
  public_id: 'pub-1',
  full_name: 'Juan Dela Cruz',
  appointment_date: '2026-11-27',
  appointment_time: null,
  service_type: 'consultation',
  service_name: 'Medical Consultation',
  consulting_facility: 'CHO Bacolod',
  status: 'scheduled',
  created_at: '2026-11-26 18:00:00',
  age: 36,
  yakap_registered: false,
}

const DETAIL = {
  ...LIST_ROW,
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  middle_name: '',
  suffix: '',
  birthdate: '1990-01-15',
  gender: 'Male',
  civil_status: 'Single',
  spouse_name: '',
  mothers_maiden_name: '',
  employment_status: '',
  primary_care_benefit_member: false,
  yakap_facility: '',
  philhealth_member: false,
  philhealth_number: '',
  philhealth_status: '',
  facility_household_number: '',
  pwd: false,
  notes: '',
  updated_at: '',
  contact_number: '09171234567',
  residential_address: '123 Lacson Street',
}

let container: HTMLDivElement
let root: Root | undefined
let scrollIntoView: ReturnType<typeof vi.fn>

function response(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  scrollIntoView = vi.fn()

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
  Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView']

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/appointments/1')) {
        return response({ appointment: DETAIL })
      }
      if (url.startsWith('/api/appointments')) {
        return response([LIST_ROW])
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
  )
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

describe('admin appointment details', () => {
  it('opens details from the patient name and scrolls the panel into view', async () => {
    act(() => {
      root?.render(
        createElement(AdminDashboard, { adminUsername: 'staff', adminRole: 'admin' })
      )
    })
    await flush()

    const nameButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === 'Juan Dela Cruz'
    )
    expect(nameButton).toBeDefined()

    await click(nameButton as HTMLButtonElement)

    const panel = container.querySelector('[role="region"][aria-label="Appointment details"]')
    expect(panel).not.toBeNull()
    expect(panel?.textContent).toContain('Juan Dela Cruz')
    expect(panel?.textContent).toContain('09171234567')
    expect(scrollIntoView).toHaveBeenCalled()
    expect(document.activeElement).toBe(panel)
  })
})
