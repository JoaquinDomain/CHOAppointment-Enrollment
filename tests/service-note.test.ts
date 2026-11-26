/**
 * @vitest-environment jsdom
 */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ServiceSelector from '@/components/ServiceSelector'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root | undefined

function Harness() {
  const [selected, setSelected] = useState<string | null>(null)
  return createElement(ServiceSelector, {
    selectedService: selected,
    onServiceSelect: setSelected,
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(createElement(Harness)))
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container.remove()
})

function serviceButton(name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(candidate =>
    candidate.getAttribute('aria-label')?.startsWith(name)
  )
  if (!button) throw new Error(`Service ${name} was not rendered`)
  return button as HTMLButtonElement
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('immunization eligibility note', () => {
  it('appears when Immunization is selected and is announced', async () => {
    expect(container.textContent).not.toContain('Under 5 years old only')

    await click(serviceButton('Immunization'))

    expect(container.textContent).toContain('Under 5 years old only and Wednesday only.')
    const note = container.querySelector('[role="status"]')
    expect(note).not.toBeNull()
    expect(note?.getAttribute('aria-live')).toBe('polite')
    expect(note?.previousElementSibling).toBe(serviceButton('Immunization'))
    expect(serviceButton('Immunization').getAttribute('aria-describedby')).toBe(
      'immunization-note'
    )
  })

  it('shows the afternoon-only note for Medical Certificate', async () => {
    await click(serviceButton('Medical Certificate'))

    expect(container.textContent).toContain('Only afternoon.')
    const note = container.querySelector('#medical-certificate-note')
    expect(note).not.toBeNull()
    expect(note?.getAttribute('role')).toBe('status')
    expect(note?.previousElementSibling).toBe(serviceButton('Medical Certificate'))
    expect(serviceButton('Medical Certificate').getAttribute('aria-describedby')).toBe(
      'medical-certificate-note'
    )
  })

  it('disappears when another service is selected', async () => {
    await click(serviceButton('Immunization'))
    expect(container.textContent).toContain('Under 5 years old only')

    await click(serviceButton('Medical Consultation'))

    expect(container.textContent).not.toContain('Under 5 years old only')
  })
})
