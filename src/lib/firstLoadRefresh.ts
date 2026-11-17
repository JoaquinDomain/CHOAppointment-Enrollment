export const FIRST_LOAD_REFRESH_STORAGE_KEY = 'cho:first-load-refresh:v1'

export function installFirstLoadRefresh(win: Window, storageKey: string): boolean {
  try {
    if (win.sessionStorage.getItem(storageKey) === '1') return false
    win.sessionStorage.setItem(storageKey, '1')
  } catch {
    return false
  }

  win.location.reload()
  return true
}

export const FIRST_LOAD_REFRESH_SCRIPT = `(${installFirstLoadRefresh.toString()})(window, ${JSON.stringify(FIRST_LOAD_REFRESH_STORAGE_KEY)});`
