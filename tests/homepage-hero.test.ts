/**
 * @vitest-environment jsdom
 *
 * Focused guard for the public homepage hero. Only the title and badge copy
 * are asserted; QR generation and appointment behaviour are untouched.
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import AppointmentForm from '@/components/AppointmentForm'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root | undefined

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(createElement(AppointmentForm))
  })
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container.remove()
})

describe('homepage hero', () => {
  it('uses the system-wide appointment title', () => {
    const heading = container.querySelector('h1')
    expect(heading?.textContent?.trim()).toBe('BACOLOD CITY HEALTH APPOINTMENT SYSTEM')
  })

  it('keeps the office badge and weekday badge only', () => {
    const text = container.textContent ?? ''

    expect(text).toContain('City Health Office · Bacolod City')
    expect(text).toContain('Mon – Fri only')
    expect(text).not.toContain('Lab opens 8:00 AM')
    expect(text).not.toContain('QR check-in')
  })

  it('preserves the green gradient hero treatment', () => {
    const hero = container.querySelector('.from-emerald-800')
    expect(hero).not.toBeNull()
    expect(hero?.className).toContain('to-teal-700')
    expect(hero?.className).toContain('rounded-3xl')
  })

  it('centers the remaining weekday badge', () => {
    const badgeRow = container.querySelector('h1 + div')
    expect(badgeRow?.className).toContain('justify-center')
  })

  it('does not repeat the privacy policy link above Continue', () => {
    const labels = Array.from(container.querySelectorAll('a')).map(link =>
      link.textContent?.trim()
    )
    expect(labels).not.toContain('Read the Privacy Policy')
  })
})
