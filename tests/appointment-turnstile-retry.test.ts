/**
 * @vitest-environment jsdom
 */
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/components/DatePicker', async () => {
  const { createElement } = await import('react')

  return {
    default: ({ onDateSelect }: { onDateSelect: (date: string) => void }) =>
      createElement(
        'button',
        { id: 'pick-date', onClick: () => onDateSelect('2026-11-20') },
        'Pick date',
      ),
  }
})

vi.mock('@/components/ServiceSelector', async () => {
  const { createElement } = await import('react')

  return {
    default: ({ onServiceSelect }: { onServiceSelect: (service: string) => void }) =>
      createElement(
        'button',
        { id: 'pick-service', onClick: () => onServiceSelect('consultation') },
        'Pick service',
      ),
  }
})

vi.mock('@/components/EnrollmentModal', async () => {
  const { createElement } = await import('react')

  interface ModalProps {
    onSave: (data: Record<string, unknown>) => boolean | Promise<boolean>
    onClose: () => void
    initialData?: { firstName?: string }
    turnstileWidget?: ReactNode
  }

  const enrollment = {
    firstName: 'Ada',
    middleName: '',
    lastName: 'Lovelace',
    suffix: '',
    birthdate: '1990-01-01',
    age: 36,
    gender: 'female',
    civilStatus: 'single',
    residentialAddress: '1 Health Street',
    contactNumber: '09171234567',
    spouseName: '',
    mothersMaidenName: '',
    employmentStatus: '',
    primaryCareBenefitMember: false,
    philhealthMember: false,
    philhealthNumber: '',
    philhealthStatus: '',
    facilityHouseholdNumber: '',
    pwd: false,
    yakapRegistered: false,
    yakapFacility: '',
    consultingFacility: 'Example Health Center',
    dataPrivacyConsent: true,
  }

  return {
    default: ({ onSave, onClose, initialData, turnstileWidget }: ModalProps) =>
      createElement(
        'div',
        null,
        createElement(
          'p',
          { id: 'saved-enrollment' },
          initialData?.firstName ?? 'no-enrollment',
        ),
        turnstileWidget,
        createElement(
          'button',
          {
            id: 'save-appointment',
            onClick: async () => {
              const saved = await onSave(enrollment)
              if (saved) onClose()
            },
          },
          'Save appointment',
        ),
      ),
  }
})

vi.mock('@/components/TurnstileWidget', async () => {
  const { createElement } = await import('react')
  let tokenNumber = 0

  return {
    default: ({
      onToken,
      resetKey,
    }: {
      onToken: (token: string | null) => void
      resetKey?: number
    }) =>
      createElement(
        'div',
        null,
        createElement('span', { id: 'reset-key' }, String(resetKey ?? 0)),
        createElement(
          'button',
          {
            id: 'emit-token',
            onClick: () => onToken(`token-${++tokenNumber}`),
          },
          'Emit token',
        ),
      ),
  }
})

vi.mock('qrcode.react', async () => {
  const { createElement } = await import('react')

  return {
    QRCodeCanvas: () => createElement('div', { id: 'qr-code' }),
  }
})

import AppointmentForm from '@/components/AppointmentForm'
import { BACOLOD_HEALTH_FACILITIES } from '@/constants/facilities'

let container: HTMLDivElement
let root: Root | undefined

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as unknown as Response
}

async function click(selector: string) {
  const element = container.querySelector(selector)
  if (!element) throw new Error(`Element ${selector} was not rendered`)

  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

function findButtonByText(text: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(button =>
    button.textContent?.includes(text),
  )
}

async function clickButtonByText(text: string) {
  const button = findButtonByText(text)
  if (!button) throw new Error(`Button ${text} was not rendered`)

  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }
  container.remove()
  vi.unstubAllGlobals()
})

describe('appointment Turnstile retry flow', () => {
  it('clears the rejected token, keeps enrollment data, and retries with a fresh token', async () => {
    const postedBodies: Record<string, unknown>[] = []
    const postResponses = [
      jsonResponse({ error: 'Human verification failed. Please try again.' }, false),
      jsonResponse({ error: 'Human verification failed. Please try again.' }, false),
      jsonResponse({ public_id: 'APT-100', qr_url: 'https://example.test/qr/APT-100' }),
    ]

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input)

        if (url.startsWith('/api/availability')) {
          return jsonResponse({ services: [] })
        }

        if (url === '/api/appointments' && init?.method === 'POST') {
          postedBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
          const next = postResponses.shift()
          if (!next) throw new Error('Unexpected appointment POST')
          return next
        }

        throw new Error(`Unexpected fetch: ${url}`)
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    act(() => {
      root?.render(createElement(AppointmentForm))
    })

    await click('#pick-date')
    await click('#pick-service')
    await clickButtonByText('Continue')

    expect(container.querySelector('#saved-enrollment')?.textContent).toBe('no-enrollment')

    await click('#emit-token')
    await click('#save-appointment')

    expect(postedBodies).toHaveLength(1)
    expect(postedBodies[0].turnstile_token).toBe('token-1')
    expect(container.textContent).toContain('Human verification failed. Please try again.')
    expect(container.querySelector('#reset-key')?.textContent).toBe('1')
    expect(container.querySelector('#saved-enrollment')?.textContent).toBe('Ada')

    await click('#save-appointment')

    expect(postedBodies).toHaveLength(2)
    expect(postedBodies[1]).not.toHaveProperty('turnstile_token')
    expect(container.querySelector('#reset-key')?.textContent).toBe('2')

    await click('#emit-token')

    expect(container.querySelector('#reset-key')?.textContent).toBe('2')

    await click('#save-appointment')

    expect(postedBodies).toHaveLength(3)
    expect(postedBodies[2].turnstile_token).toBe('token-2')
    expect(container.textContent).toContain('Appointment confirmed')
    expect(container.textContent).toContain('APT-100')
    expect(container.textContent).toContain('November 20, 2026')
    expect(container.textContent).toContain('Medical Consultation')
    expect(container.textContent).toContain('Example Health Center')
    expect(container.querySelector('#qr-code')).not.toBeNull()
  })

  it('prevents double submission with the real enrollment modal', async () => {
    const { default: EnrollmentModal } = await vi.importActual<
      typeof import('@/components/EnrollmentModal')
    >('@/components/EnrollmentModal')

    let resolveSave: (saved: boolean) => void = () => {}
    const savePromise = new Promise<boolean>(resolve => {
      resolveSave = resolve
    })
    const onSave = vi.fn(() => savePromise)
    const onClose = vi.fn()

    act(() => {
      root?.render(
        createElement(EnrollmentModal, {
          isOpen: true,
          inline: true,
          onClose,
          onSave,
        }),
      )
    })

    const form = container.querySelector('form')
    if (!form) throw new Error('Enrollment form was not rendered')

    const setInput = (name: string, value: string) => {
      const element = container.querySelector<HTMLInputElement>(`[name="${name}"]`)
      if (!element) throw new Error(`Field ${name} was not rendered`)
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      setter?.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }

    const setSelect = (name: string, value: string) => {
      const element = container.querySelector<HTMLSelectElement>(`[name="${name}"]`)
      if (!element) throw new Error(`Field ${name} was not rendered`)
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )?.set
      setter?.call(element, value)
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }

    await act(async () => {
      setInput('lastName', 'Santos')
      setInput('firstName', 'Maria')
      setInput('birthdate', '1990-01-15')
      setSelect('gender', 'Female')
      setInput('residentialAddress', '123 Lacson Street')
      setInput('contactNumber', '09171234567')
      setSelect('consultingFacility', BACOLOD_HEALTH_FACILITIES[0])
      container.querySelector<HTMLInputElement>('[name="dataPrivacyConsent"]')?.click()
    })

    const submitButton = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null
    if (!submitButton) throw new Error('Submit button was not rendered')

    const submitEvent = () =>
      new Event('submit', { bubbles: true, cancelable: true })

    await act(async () => {
      form.dispatchEvent(submitEvent())
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(submitButton.disabled).toBe(true)

    // A second rapid submission must be ignored while the first is pending.
    await act(async () => {
      form.dispatchEvent(submitEvent())
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(submitButton.disabled).toBe(true)

    await act(async () => {
      resolveSave(false)
      await savePromise
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(submitButton.disabled).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })
})
