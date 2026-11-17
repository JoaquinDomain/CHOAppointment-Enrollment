import { describe, expect, it, vi } from 'vitest'
import {
  FIRST_LOAD_REFRESH_SCRIPT,
  FIRST_LOAD_REFRESH_STORAGE_KEY,
  installFirstLoadRefresh,
} from '@/lib/firstLoadRefresh'

const ORIGIN = 'https://cho-appointment-services.bacolodcity.gov.ph'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

interface FakeWindowOptions {
  href?: string
  existingFlag?: string
  getItem?: (key: string) => string | null
  setItem?: (key: string, value: string) => void
}

function createFakeWindow({
  href = `${ORIGIN}/?service=laboratory`,
  existingFlag,
  getItem,
  setItem,
}: FakeWindowOptions = {}) {
  const storage = new MemoryStorage()
  if (existingFlag !== undefined) storage.setItem(FIRST_LOAD_REFRESH_STORAGE_KEY, existingFlag)

  const reload = vi.fn()
  const addEventListener = vi.fn()
  const win = {
    sessionStorage: {
      getItem: getItem ?? ((key: string) => storage.getItem(key)),
      setItem: setItem ?? ((key: string, value: string) => storage.setItem(key, value)),
    },
    location: { href, reload },
    addEventListener,
  }

  return { win: win as unknown as Window, storage, reload, addEventListener }
}

function run(fake: ReturnType<typeof createFakeWindow>) {
  return installFirstLoadRefresh(fake.win, FIRST_LOAD_REFRESH_STORAGE_KEY)
}

describe('first-load refresh', () => {
  it('sets the session flag before reloading and preserves the URL', () => {
    const fake = createFakeWindow()
    let flagAtReload: string | null = null
    fake.reload.mockImplementation(() => {
      flagAtReload = fake.win.sessionStorage.getItem(FIRST_LOAD_REFRESH_STORAGE_KEY)
    })

    expect(run(fake)).toBe(true)

    expect(flagAtReload).toBe('1')
    expect(fake.reload).toHaveBeenCalledTimes(1)
    expect(fake.win.location.href).toBe(`${ORIGIN}/?service=laboratory`)
  })

  it('does not reload again after the first automatic refresh', () => {
    const fake = createFakeWindow()

    expect(run(fake)).toBe(true)
    expect(run(fake)).toBe(false)

    expect(fake.reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload when the session flag already exists', () => {
    const fake = createFakeWindow({ existingFlag: '1' })

    expect(run(fake)).toBe(false)
    expect(fake.reload).not.toHaveBeenCalled()
  })

  it('does not reload when reading sessionStorage fails', () => {
    const fake = createFakeWindow({
      getItem: () => {
        throw new Error('storage unavailable')
      },
    })
    const setItem = vi.spyOn(fake.win.sessionStorage, 'setItem')

    expect(run(fake)).toBe(false)

    expect(setItem).not.toHaveBeenCalled()
    expect(fake.reload).not.toHaveBeenCalled()
  })

  it('does not reload when writing sessionStorage fails', () => {
    const fake = createFakeWindow({
      setItem: () => {
        throw new Error('storage unavailable')
      },
    })

    expect(run(fake)).toBe(false)
    expect(fake.reload).not.toHaveBeenCalled()
  })

  it('does not reload when sessionStorage itself is unavailable', () => {
    const reload = vi.fn()
    const win = {
      get sessionStorage(): Storage {
        throw new Error('security error')
      },
      location: { href: `${ORIGIN}/`, reload },
    } as unknown as Window

    expect(installFirstLoadRefresh(win, FIRST_LOAD_REFRESH_STORAGE_KEY)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not attach error or navigation listeners', () => {
    const fake = createFakeWindow()

    run(fake)

    expect(fake.addEventListener).not.toHaveBeenCalled()
  })

  it('runs once as a standalone inline script', () => {
    const fake = createFakeWindow()

    new Function('window', FIRST_LOAD_REFRESH_SCRIPT)(fake.win)
    new Function('window', FIRST_LOAD_REFRESH_SCRIPT)(fake.win)

    expect(fake.reload).toHaveBeenCalledTimes(1)
    expect(fake.win.sessionStorage.getItem(FIRST_LOAD_REFRESH_STORAGE_KEY)).toBe('1')
  })
})
