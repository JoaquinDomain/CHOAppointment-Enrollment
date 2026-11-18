// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHUNK_RECOVERY_DELAY_MS,
  CHUNK_RECOVERY_STORAGE_KEY,
  HYDRATION_WATCHDOG_MS,
  LOAD_NOTICE_ID,
  PAGE_HEALTH_SCRIPT,
  installPageHealth,
  markHydrated,
} from '@/lib/pageHealth'

const ORIGIN = 'https://cho-appointment-services.bacolodcity.gov.ph'

class MemoryStorage {
  readonly values = new Map<string, string>()

  readonly getItem = vi.fn((key: string) => this.values.get(key) ?? null)

  readonly setItem = vi.fn((key: string, value: string) => {
    this.values.set(key, value)
  })

  readonly removeItem = vi.fn((key: string) => {
    this.values.delete(key)
  })
}

interface FakeWindowOptions {
  existingGuard?: boolean
  failStorage?: 'get' | 'set' | 'remove' | 'all'
}

function createFakeWindow(options: FakeWindowOptions = {}) {
  const storage = new MemoryStorage()
  if (options.existingGuard) storage.values.set(CHUNK_RECOVERY_STORAGE_KEY, '1')

  if (options.failStorage === 'get' || options.failStorage === 'all') {
    storage.getItem.mockImplementation(() => {
      throw new Error('storage unavailable')
    })
  }
  if (options.failStorage === 'set' || options.failStorage === 'all') {
    storage.setItem.mockImplementation(() => {
      throw new Error('storage unavailable')
    })
  }
  if (options.failStorage === 'remove' || options.failStorage === 'all') {
    storage.removeItem.mockImplementation(() => {
      throw new Error('storage unavailable')
    })
  }

  const reload = vi.fn()
  const win = {
    sessionStorage: storage,
    location: { href: `${ORIGIN}/`, reload },
    setTimeout: (handler: () => void, timeout?: number) =>
      globalThis.setTimeout(handler, timeout),
    clearTimeout: (id?: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id),
  }

  return { win: win as unknown as Window, storage, reload }
}

let doc: Document

function startPageHealth(options: FakeWindowOptions = {}) {
  const fake = createFakeWindow(options)
  installPageHealth(fake.win, doc, CHUNK_RECOVERY_STORAGE_KEY)
  return fake
}

function dispatchScriptError(src: string) {
  const script = doc.createElement('script')
  script.setAttribute('src', src)
  doc.body.appendChild(script)
  script.dispatchEvent(new Event('error'))
}

function dispatchErrorOn(tagName: string) {
  const element = doc.createElement(tagName)
  doc.body.appendChild(element)
  element.dispatchEvent(new Event('error'))
}

beforeEach(() => {
  vi.useFakeTimers()
  doc = document.implementation.createHTMLDocument('page-health-test')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('page-health chunk recovery', () => {
  it('does not reload a healthy page automatically', () => {
    const fake = startPageHealth()

    vi.advanceTimersByTime(CHUNK_RECOVERY_DELAY_MS)

    expect(fake.reload).not.toHaveBeenCalled()
    expect(fake.storage.values.has(CHUNK_RECOVERY_STORAGE_KEY)).toBe(false)
  })

  it('schedules exactly one automatic retry for a failed /_next/static/ script', () => {
    const fake = startPageHealth()

    expect(fake.win.__choReady).toBe(false)

    dispatchScriptError('https://example.test/_next/static/chunks/app.js')

    expect(fake.storage.values.get(CHUNK_RECOVERY_STORAGE_KEY)).toBe('1')
    expect(fake.reload).not.toHaveBeenCalled()

    vi.advanceTimersByTime(CHUNK_RECOVERY_DELAY_MS - 1)
    expect(fake.reload).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fake.reload).toHaveBeenCalledTimes(1)
  })

  it('ignores failures from unrelated scripts and non-script elements', () => {
    const fake = startPageHealth()

    dispatchScriptError('https://example.test/scripts/analytics.js')
    dispatchErrorOn('img')

    vi.advanceTimersByTime(CHUNK_RECOVERY_DELAY_MS)

    expect(fake.reload).not.toHaveBeenCalled()
    expect(fake.storage.values.has(CHUNK_RECOVERY_STORAGE_KEY)).toBe(false)
  })

  it('does not retry when a previous retry guard is already set', () => {
    const fake = startPageHealth({ existingGuard: true })

    dispatchScriptError('/_next/static/chunks/app.js')
    vi.advanceTimersByTime(CHUNK_RECOVERY_DELAY_MS)

    expect(fake.reload).not.toHaveBeenCalled()
    expect(fake.storage.values.get(CHUNK_RECOVERY_STORAGE_KEY)).toBe('1')
  })

  const userInputCases: Array<[string, () => HTMLElement]> = [
    [
      'a text input',
      () => {
        const input = doc.createElement('input')
        input.value = 'Jane Doe'
        doc.body.appendChild(input)
        return input
      },
    ],
    [
      'a textarea',
      () => {
        const textarea = doc.createElement('textarea')
        textarea.value = 'Notes'
        doc.body.appendChild(textarea)
        return textarea
      },
    ],
    [
      'a select',
      () => {
        const select = doc.createElement('select')
        const option = doc.createElement('option')
        option.value = 'laboratory'
        option.textContent = 'Laboratory'
        select.appendChild(option)
        select.value = 'laboratory'
        doc.body.appendChild(select)
        return select
      },
    ],
    [
      'a checked checkbox',
      () => {
        const checkbox = doc.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = true
        doc.body.appendChild(checkbox)
        return checkbox
      },
    ],
    [
      'a checked radio button',
      () => {
        const radio = doc.createElement('input')
        radio.type = 'radio'
        radio.checked = true
        doc.body.appendChild(radio)
        return radio
      },
    ],
    [
      'a file input with a selected file',
      () => {
        const fileInput = doc.createElement('input')
        fileInput.type = 'file'
        Object.defineProperty(fileInput, 'files', {
          value: [{ name: 'id.png' }],
          configurable: true,
        })
        doc.body.appendChild(fileInput)
        return fileInput
      },
    ],
    [
      'a contenteditable element with text',
      () => {
        const editor = doc.createElement('div')
        editor.setAttribute('contenteditable', 'true')
        editor.textContent = 'Typed text'
        doc.body.appendChild(editor)
        return editor
      },
    ],
  ]

  it.each(userInputCases)(
    'never automatically reloads after %s contains user input',
    (_label, addInput) => {
      const fake = startPageHealth()
      addInput()

      dispatchScriptError('/_next/static/chunks/app.js')
      vi.advanceTimersByTime(CHUNK_RECOVERY_DELAY_MS)

      expect(fake.reload).not.toHaveBeenCalled()
    }
  )

  it('remembers typing and then deleting text as user interaction', () => {
    const fake = startPageHealth()
    const input = doc.createElement('input')
    doc.body.appendChild(input)

    input.value = 'temporary'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))

    dispatchScriptError('/_next/static/chunks/app.js')
    vi.advanceTimersByTime(CHUNK_RECOVERY_DELAY_MS)

    expect(fake.reload).not.toHaveBeenCalled()
  })

  it('cancels a scheduled reload when input arrives during the delay', () => {
    const fake = startPageHealth()

    dispatchScriptError('/_next/static/chunks/app.js')
    vi.advanceTimersByTime(CHUNK_RECOVERY_DELAY_MS - 500)

    const input = doc.createElement('input')
    doc.body.appendChild(input)
    input.value = 'late input'
    input.dispatchEvent(new Event('change', { bubbles: true }))

    vi.advanceTimersByTime(500)

    expect(fake.reload).not.toHaveBeenCalled()
  })

  it('does not auto-reload or loop when sessionStorage is inaccessible', () => {
    const fake = startPageHealth({ failStorage: 'all' })

    dispatchScriptError('/_next/static/chunks/app.js')
    vi.advanceTimersByTime(HYDRATION_WATCHDOG_MS)

    expect(fake.reload).not.toHaveBeenCalled()
  })
})

describe('hydration watchdog', () => {
  it('shows an accessible notice after 10 seconds without hydration', () => {
    startPageHealth()

    vi.advanceTimersByTime(HYDRATION_WATCHDOG_MS - 1)
    expect(doc.getElementById(LOAD_NOTICE_ID)).toBeNull()

    vi.advanceTimersByTime(1)

    const notice = doc.getElementById(LOAD_NOTICE_ID)
    const button = notice?.querySelector('button')

    expect(notice).not.toBeNull()
    expect(notice?.getAttribute('role')).toBe('status')
    expect(notice?.textContent).toContain('taking longer than usual')
    expect(button?.textContent).toBe('Refresh')
  })

  it('reloads the page when the notice Refresh button is clicked', () => {
    const fake = startPageHealth()

    vi.advanceTimersByTime(HYDRATION_WATCHDOG_MS)
    const button = doc.querySelector(`#${LOAD_NOTICE_ID} button`)

    expect(button).not.toBeNull()
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(fake.reload).toHaveBeenCalledTimes(1)
  })

  it('removes the watchdog immediately after successful hydration', () => {
    const fake = startPageHealth()

    vi.advanceTimersByTime(HYDRATION_WATCHDOG_MS)
    expect(doc.getElementById(LOAD_NOTICE_ID)).not.toBeNull()

    markHydrated(fake.win, CHUNK_RECOVERY_STORAGE_KEY)

    expect(fake.win.__choReady).toBe(true)
    expect(doc.getElementById(LOAD_NOTICE_ID)).toBeNull()

    vi.advanceTimersByTime(HYDRATION_WATCHDOG_MS)
    expect(doc.getElementById(LOAD_NOTICE_ID)).toBeNull()
    expect(fake.reload).not.toHaveBeenCalled()
  })

  it('clears the sessionStorage retry guard on successful hydration', () => {
    const fake = startPageHealth({ existingGuard: true })

    expect(fake.storage.values.get(CHUNK_RECOVERY_STORAGE_KEY)).toBe('1')

    markHydrated(fake.win, CHUNK_RECOVERY_STORAGE_KEY)

    expect(fake.storage.values.has(CHUNK_RECOVERY_STORAGE_KEY)).toBe(false)
    expect(fake.storage.removeItem).toHaveBeenCalledWith(CHUNK_RECOVERY_STORAGE_KEY)
  })

  it('handles a sessionStorage cleanup failure during hydration safely', () => {
    const fake = startPageHealth({ failStorage: 'remove' })
    fake.win.__choReady = false

    expect(() => markHydrated(fake.win, CHUNK_RECOVERY_STORAGE_KEY)).not.toThrow()
    expect(fake.win.__choReady).toBe(true)
  })
})

describe('page-health integration', () => {
  it('runs as a standalone inline script with the expected storage guard', () => {
    const fake = createFakeWindow()

    new Function('window', 'document', PAGE_HEALTH_SCRIPT)(fake.win, doc)
    expect(fake.win.__choReady).toBe(false)

    dispatchScriptError('/_next/static/chunks/app.js')
    vi.advanceTimersByTime(CHUNK_RECOVERY_DELAY_MS)

    expect(fake.reload).toHaveBeenCalledTimes(1)
  })

  it('is included in the root layout with the request nonce and HydrationPing', () => {
    const layout = readFileSync(
      join(process.cwd(), 'src/app/layout.tsx'),
      'utf8'
    )

    expect(layout).toContain(
      'const nonce = (await headers()).get("x-nonce") ?? undefined;'
    )
    expect(layout).toMatch(
      /<script\s+nonce=\{nonce\}\s+dangerouslySetInnerHTML=\{\{ __html: PAGE_HEALTH_SCRIPT \}\}\s+\/>/
    )
    expect(layout).toContain('<HydrationPing />')
    expect(layout).toContain('<Navigation />')
    expect(layout).toContain('<main className="flex-1">{children}</main>')
    expect(layout).toContain('PrivacyPolicyLink')
    expect(layout).not.toContain('FIRST_LOAD_REFRESH_SCRIPT')
  })

  it('uses addEventListener and no inline HTML event handlers', () => {
    expect(PAGE_HEALTH_SCRIPT).toContain('addEventListener')
    expect(PAGE_HEALTH_SCRIPT).not.toMatch(/onclick\s*=/i)
  })

  it('keeps the nonce-based strict CSP without unsafe-inline in script-src', () => {
    const proxy = readFileSync(join(process.cwd(), 'src/proxy.ts'), 'utf8')
    const scriptSrcLine = proxy
      .split('\n')
      .find(line => line.includes("script-src 'self'"))

    expect(scriptSrcLine).toBeDefined()
    expect(scriptSrcLine).toContain("'nonce-${nonce}'")
    expect(scriptSrcLine).toContain("'strict-dynamic'")
    expect(scriptSrcLine).not.toContain("'unsafe-inline'")
  })
})
