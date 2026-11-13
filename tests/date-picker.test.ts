/**
 * @vitest-environment jsdom
 */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DatePicker, { getCalendarDayClassName } from '@/components/DatePicker'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const MIN_DATE = new Date(2026, 10, 1)
const MAX_DATE = new Date(2027, 11, 31)

let container: HTMLDivElement
let root: Root

interface HarnessProps {
  initialDate: string | null
  onSelected?: (date: string) => void
}

function Harness({ initialDate, onSelected }: HarnessProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate)

  return createElement(DatePicker, {
    selectedDate,
    onDateSelect: (date: string) => {
      onSelected?.(date)
      setSelectedDate(date)
    },
    minDate: MIN_DATE,
    maxDate: MAX_DATE,
  })
}

function renderPicker(initialDate: string | null, onSelected?: (date: string) => void) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(createElement(Harness, { initialDate, onSelected }))
  })
}

function getDayButton(iso: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(candidate =>
    candidate.getAttribute('aria-label')?.startsWith(iso),
  )
  if (!button) throw new Error(`Date button ${iso} was not rendered`)
  return button as HTMLButtonElement
}

async function click(button: HTMLElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  container?.remove()
  vi.useRealTimers()
})

describe('DatePicker selected-date highlight', () => {
  it('moves the selected highlight and green ring from today to the clicked date', async () => {
    const onSelected = vi.fn()
    renderPicker('2026-11-13', onSelected)

    expect(getDayButton('2026-11-13').dataset.selected).toBe('true')
    expect(getDayButton('2026-11-19').dataset.selected).toBeUndefined()

    await click(getDayButton('2026-11-19'))

    expect(onSelected).toHaveBeenCalledWith('2026-11-19')
    expect(getDayButton('2026-11-19').dataset.selected).toBe('true')
    expect(getDayButton('2026-11-19').className).toContain('bg-emerald-600')
    expect(getDayButton('2026-11-19').className).toContain('ring-emerald-500')
    expect(getDayButton('2026-11-13').dataset.selected).toBeUndefined()
    expect(getDayButton('2026-11-13').className).not.toContain('ring-emerald-500')
    expect(getDayButton('2026-11-13').className).not.toContain('bg-emerald-600')
  })

  it('moves the highlight again when another date is selected', async () => {
    renderPicker('2026-11-19')

    await click(getDayButton('2026-11-20'))

    expect(getDayButton('2026-11-20').dataset.selected).toBe('true')
    expect(getDayButton('2026-11-20').className).toContain('ring-emerald-500')
    expect(getDayButton('2026-11-19').dataset.selected).toBeUndefined()
    expect(getDayButton('2026-11-19').className).not.toContain('ring-emerald-500')
  })

  it('keeps today as a separate indicator from the selected date', async () => {
    renderPicker('2026-11-19')

    const today = getDayButton('2026-11-13')
    const selected = getDayButton('2026-11-19')

    expect(today.getAttribute('aria-current')).toBe('date')
    expect(today.dataset.today).toBe('true')
    expect(today.querySelector('[data-today-indicator]')).not.toBeNull()
    expect(today.className).not.toContain('ring-emerald-500')
    expect(today.dataset.selected).toBeUndefined()
    expect(selected.dataset.selected).toBe('true')
    expect(selected.getAttribute('aria-current')).toBeNull()
    expect(selected.dataset.today).toBeUndefined()
  })

  it('does not keep an outdated highlight when navigating between months', async () => {
    renderPicker('2026-11-19')

    await click(container.querySelector('button[aria-label="Next month"]') as HTMLButtonElement)

    expect(container.textContent).toContain('December 2026')
    expect(getDayButton('2026-12-19').dataset.selected).toBeUndefined()
    expect(getDayButton('2026-12-19').className).not.toContain('ring-emerald-500')
    expect(getDayButton('2026-12-19').className).not.toContain('bg-emerald-600')

    await click(container.querySelector('button[aria-label="Previous month"]') as HTMLButtonElement)

    expect(getDayButton('2026-11-19').dataset.selected).toBe('true')
    expect(getDayButton('2026-11-19').className).toContain('ring-emerald-500')
  })

  it('synchronizes the selected date with the date input and the consumer callback', async () => {
    const onSelected = vi.fn()
    renderPicker(null, onSelected)

    await click(getDayButton('2026-11-19'))

    expect(onSelected).toHaveBeenCalledWith('2026-11-19')
    expect((container.querySelector('#appointment-date') as HTMLInputElement).value).toBe('2026-11-19')
  })

  it('keeps the selected date after the calendar re-renders', async () => {
    renderPicker(null)

    await click(getDayButton('2026-11-19'))
    act(() => {
      root.render(createElement(Harness, { initialDate: null }))
    })

    expect(getDayButton('2026-11-19').className).toContain('ring-2')
    expect(getDayButton('2026-11-19').dataset.selected).toBe('true')
  })

  it('does not select disabled weekend or holiday dates', async () => {
    const onSelected = vi.fn()
    renderPicker(null, onSelected)

    const weekend = getDayButton('2026-11-14')
    const holiday = getDayButton('2026-11-30')

    expect(weekend.disabled).toBe(true)
    expect(holiday.disabled).toBe(true)

    await click(weekend)
    await click(holiday)

    expect(onSelected).not.toHaveBeenCalled()
    expect(weekend.dataset.selected).toBeUndefined()
    expect(holiday.dataset.selected).toBeUndefined()
  })

  it('gives the selected state precedence over the today style', () => {
    const className = getCalendarDayClassName({
      isSelected: true,
      isToday: true,
      disabled: false,
      holiday: false,
      weekend: false,
    })

    expect(className).toContain('bg-emerald-600')
    expect(className).toContain('ring-2')
    expect(className).toContain('ring-emerald-500')
  })
})
