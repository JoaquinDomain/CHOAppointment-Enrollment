/**
 * @vitest-environment jsdom
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentModal from '@/components/EnrollmentModal'
import { BACOLOD_HEALTH_FACILITIES } from '@/constants/facilities'
import {
  findFirstInvalidField,
  focusFirstInvalidField,
  scrollFieldIntoView,
} from '@/lib/formErrorFocus'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root | undefined
let scrollTo: ReturnType<typeof vi.fn>

beforeEach(() => {
  document.body.innerHTML = ''
  container = document.createElement('div')
  document.body.appendChild(container)
  scrollTo = vi.fn()
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container.remove()
  vi.restoreAllMocks()
})

function renderForm(onSave = vi.fn().mockResolvedValue(true)) {
  const onClose = vi.fn()
  root = createRoot(container)
  act(() => {
    root?.render(
      createElement(EnrollmentModal, {
        isOpen: true,
        inline: true,
        onClose,
        onSave,
        selectedService: 'consultation',
      })
    )
  })
  return { onSave, onClose }
}

function field(name: string): HTMLInputElement | HTMLSelectElement {
  const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[name="${name}"]`
  )
  if (!element) throw new Error(`Field ${name} was not rendered`)
  return element
}

function errorFor(name: string): HTMLElement | null {
  return container.querySelector(`#enrollment-${name}-error`)
}

async function setText(name: string, value: string) {
  const element = field(name) as HTMLInputElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function setSelect(name: string, value: string) {
  const element = field(name) as HTMLSelectElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value'
    )?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function toggle(name: string) {
  const element = field(name) as HTMLInputElement
  await act(async () => {
    element.click()
  })
}

async function submit() {
  const form = container.querySelector('form')
  if (!form) throw new Error('Form was not rendered')
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

async function fillRequired(
  options: { contact?: boolean; consent?: boolean; gender?: string } = {}
) {
  const { contact = true, consent = true, gender = 'Female' } = options
  await setText('lastName', 'Santos')
  await setText('firstName', 'Maria')
  await setText('birthdate', '1990-01-15')
  await setSelect('gender', gender)
  await setText('residentialAddress', '123 Lacson Street')
  await setSelect('consultingFacility', BACOLOD_HEALTH_FACILITIES[0])
  if (contact) await setText('contactNumber', '09171234567')
  if (consent) await toggle('dataPrivacyConsent')
}

describe('EnrollmentModal validation focus', () => {
  it('scrolls to and focuses the first required field on an empty submit', async () => {
    renderForm()
    await submit()

    expect(document.activeElement).toBe(field('lastName'))
    expect(field('lastName').getAttribute('aria-invalid')).toBe('true')

    const describedBy = field('lastName').getAttribute('aria-describedby')
    expect(describedBy).toBe('enrollment-lastName-error')
    expect(container.querySelector(`#${describedBy}`)?.textContent).toContain(
      'Last name is required.'
    )
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Please correct the highlighted fields.'
    )
    expect(scrollTo).toHaveBeenCalled()
  })

  it('focuses the contact number when only that field is missing', async () => {
    renderForm()
    await fillRequired({ contact: false })
    await submit()

    expect(document.activeElement).toBe(field('contactNumber'))
    expect(errorFor('contactNumber')?.textContent).toContain(
      'Contact number is required.'
    )
    expect(field('contactNumber').getAttribute('aria-invalid')).toBe('true')
  })

  it('focuses only the first invalid field when several are empty', async () => {
    renderForm()
    await submit()

    expect(document.activeElement).toBe(field('lastName'))
    expect(document.activeElement).not.toBe(field('firstName'))
    expect(field('firstName').getAttribute('aria-invalid')).toBe('true')
  })

  it('removes the error for a field once it is corrected', async () => {
    renderForm()
    await submit()
    expect(errorFor('lastName')).not.toBeNull()

    await setText('lastName', 'Santos')

    expect(field('lastName').getAttribute('aria-invalid')).toBeNull()
    expect(errorFor('lastName')).toBeNull()
    expect(field('firstName').getAttribute('aria-invalid')).toBe('true')
  })

  it('focuses an invalid select control', async () => {
    renderForm()
    await fillRequired({ gender: '' })
    await submit()

    expect(document.activeElement).toBe(field('gender'))
    expect(errorFor('gender')?.textContent).toContain('Please select a gender.')
  })

  it('focuses the consent checkbox and associates its message', async () => {
    renderForm()
    await fillRequired({ consent: false })
    await submit()

    expect(document.activeElement).toBe(field('dataPrivacyConsent'))
    expect(errorFor('dataPrivacyConsent')?.textContent).toContain(
      'Please accept the required consent.'
    )
    expect(field('dataPrivacyConsent').getAttribute('aria-describedby')).toBe(
      'enrollment-dataPrivacyConsent-error'
    )
  })

  it('focuses the PhilHealth number when membership is selected without a PIN', async () => {
    renderForm()
    await fillRequired()
    await toggle('philhealthMember')
    await submit()

    expect(document.activeElement).toBe(field('philhealthNumber'))
    expect(errorFor('philhealthNumber')?.textContent).toContain(
      'PhilHealth number is required.'
    )
  })

  it('prevents duplicate submissions while a submission is in flight', async () => {
    let resolveSave: (value: boolean) => void = () => undefined
    const pending = new Promise<boolean>(resolve => {
      resolveSave = resolve
    })
    const onSave = vi.fn().mockReturnValue(pending)

    renderForm(onSave)
    await fillRequired()

    const form = container.querySelector('form')
    if (!form) throw new Error('Form was not rendered')

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(onSave).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSave(true)
      await pending
    })
  })

  it('does not scroll or block a valid submission', async () => {
    const { onSave } = renderForm()
    await fillRequired()
    await submit()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('form error focus utilities', () => {
  it('skips hidden and disabled invalid controls', () => {
    const form = document.createElement('form')
    form.innerHTML = `
      <input name="disabled" aria-invalid="true" disabled />
      <input name="hidden" aria-invalid="true" style="display: none" />
      <input name="visible" aria-invalid="true" />
    `
    document.body.appendChild(form)

    expect(findFirstInvalidField(form)?.getAttribute('name')).toBe('visible')
    form.remove()
  })

  it('leaves room for a sticky header when the field is obscured', () => {
    const header = document.createElement('header')
    header.style.position = 'sticky'
    header.getBoundingClientRect = () =>
      ({ height: 64, top: 0, bottom: 64 } as DOMRect)
    document.body.appendChild(header)

    const fieldElement = document.createElement('input')
    fieldElement.getBoundingClientRect = () =>
      ({ height: 24, top: 40, bottom: 64 } as DOMRect)
    document.body.appendChild(fieldElement)

    scrollFieldIntoView(fieldElement, { headerSelector: 'header' })

    expect(scrollTo).toHaveBeenCalledTimes(1)
    header.remove()
    fieldElement.remove()
  })

  it('re-corrects instantly when the visual viewport shrinks for the keyboard', () => {
    const viewport = new EventTarget() as EventTarget & {
      height: number
      offsetTop: number
    }
    viewport.height = 400
    viewport.offsetTop = 0
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })

    const form = document.createElement('form')
    const fieldElement = document.createElement('input')
    fieldElement.setAttribute('aria-invalid', 'true')
    fieldElement.getBoundingClientRect = () =>
      ({ height: 24, top: 900, bottom: 924 } as DOMRect)
    form.appendChild(fieldElement)
    document.body.appendChild(form)

    focusFirstInvalidField(form)
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: 'smooth' })
    )

    viewport.height = 200
    viewport.dispatchEvent(new Event('resize'))

    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: 'auto' })
    )

    form.remove()
    Reflect.deleteProperty(window, 'visualViewport')
  })

  it('uses instant scrolling when reduced motion is requested', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })

    const form = document.createElement('form')
    const fieldElement = document.createElement('input')
    fieldElement.setAttribute('aria-invalid', 'true')
    fieldElement.getBoundingClientRect = () =>
      ({ height: 24, top: 900, bottom: 924 } as DOMRect)
    form.appendChild(fieldElement)
    document.body.appendChild(form)

    focusFirstInvalidField(form)

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' })
    )
    form.remove()
  })
})
