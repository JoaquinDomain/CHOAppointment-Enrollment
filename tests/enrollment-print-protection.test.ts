/**
 * @vitest-environment jsdom
 *
 * Guards the printable ITR path. EnrollmentModal is shared by the interactive
 * patient form and the print-only ITR, so the validation work must not change
 * the classes, validation attributes, or structure that the printed document
 * relies on.
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentModal from '@/components/EnrollmentModal'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PRINT_CONTROL_CLASS =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm shadow-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none'
const PRINT_CONTROL_CLASS_WHITE =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white shadow-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none'

let container: HTMLDivElement
let root: Root | undefined

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  act(() => {
    root?.render(
      createElement(EnrollmentModal, {
        isOpen: true,
        inline: true,
        printOnly: true,
        onClose: vi.fn(),
        onSave: vi.fn(),
        initialData: {
          lastName: 'Santos',
          firstName: 'Maria',
          philhealthMember: true,
          philhealthNumber: '123456789012',
          philhealthStatus: 'MEMBER',
          yakapRegistered: true,
          yakapFacility: 'Health Center',
          consultingFacility: 'Health Center',
          selectedService: 'consultation',
        },
      })
    )
  })
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container.remove()
})

function field(name: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[name="${name}"]`)
  if (!element) throw new Error(`Field ${name} was not rendered`)
  return element
}

describe('print-only enrollment form', () => {
  it('keeps the original control classes', () => {
    for (const name of [
      'lastName',
      'firstName',
      'birthdate',
      'gender',
      'residentialAddress',
      'contactNumber',
      'consultingFacility',
    ]) {
      expect(field(name).className).toBe(PRINT_CONTROL_CLASS)
    }

    for (const name of ['philhealthNumber', 'philhealthStatus', 'yakapFacility']) {
      expect(field(name).className).toBe(PRINT_CONTROL_CLASS_WHITE)
    }

    expect(field('dataPrivacyConsent').className).toBe('w-4 h-4 accent-emerald-600')
  })

  it('renders no interactive validation state or messages', () => {
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull()
    expect(container.querySelector('[aria-describedby]')).toBeNull()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[id$="-error"]')).toBeNull()
  })

  it('keeps the form inert and does not enable custom validation', () => {
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    expect(form?.hasAttribute('inert')).toBe(true)
    expect(form?.hasAttribute('novalidate')).toBe(false)
  })

  it('still renders the printable header and print-only sections', () => {
    expect(container.querySelector('#enrollment-form')).not.toBeNull()
    expect(container.querySelector('.print-form-banner')).not.toBeNull()
    expect(container.querySelector('.print-only-clinical-info')).not.toBeNull()
    expect(container.querySelector('.print-doc-footer')).not.toBeNull()
  })
})
