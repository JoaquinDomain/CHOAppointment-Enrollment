export const CHUNK_RECOVERY_STORAGE_KEY = 'cho:chunk-recovery:v2'
export const CHUNK_RECOVERY_DELAY_MS = 1500
export const HYDRATION_WATCHDOG_MS = 10000
export const LOAD_NOTICE_ID = 'cho-load-notice'

interface PageHealthWindow extends Window {
  __choReady?: boolean
  __choClearWatchdog?: () => void
}

export function installPageHealth(
  win: PageHealthWindow,
  doc: Document,
  storageKey: string,
  recoveryDelayMs = CHUNK_RECOVERY_DELAY_MS,
  watchdogMs = HYDRATION_WATCHDOG_MS,
  noticeId = LOAD_NOTICE_ID
): void {
  win.__choReady = false

  let recoveryScheduled = false
  let storageUnavailable = false
  let userInteracted = false

  function markUserInteraction() {
    userInteracted = true
  }

  function hasUserInput(): boolean {
    if (userInteracted) return true

    const elements = doc.querySelectorAll(
      'input, textarea, select, [contenteditable]'
    )

    for (let index = 0; index < elements.length; index += 1) {
      const element = elements[index] as HTMLElement
      const tagName = element.tagName.toLowerCase()

      if (tagName === 'input') {
        const input = element as HTMLInputElement
        const inputType = (input.getAttribute('type') || 'text').toLowerCase()

        if (
          inputType === 'hidden' ||
          inputType === 'button' ||
          inputType === 'submit' ||
          inputType === 'reset'
        ) {
          continue
        }

        if (inputType === 'checkbox' || inputType === 'radio') {
          if (input.checked) return true
          continue
        }

        if (inputType === 'file') {
          if (input.files && input.files.length > 0) return true
          continue
        }

        if (input.value) return true
        continue
      }

      if (tagName === 'textarea') {
        if ((element as HTMLTextAreaElement).value) return true
        continue
      }

      if (tagName === 'select') {
        if ((element as HTMLSelectElement).value) return true
        continue
      }

      if (
        element.isContentEditable ||
        element.getAttribute('contenteditable') === '' ||
        element.getAttribute('contenteditable') === 'true'
      ) {
        if ((element.textContent || '').trim().length > 0) return true
      }
    }

    return false
  }

  function hasRetryGuard(): boolean {
    try {
      return win.sessionStorage.getItem(storageKey) === '1'
    } catch {
      storageUnavailable = true
      return false
    }
  }

  function setRetryGuard(): boolean {
    try {
      win.sessionStorage.setItem(storageKey, '1')
      if (win.sessionStorage.getItem(storageKey) !== '1') {
        storageUnavailable = true
        return false
      }
      return true
    } catch {
      storageUnavailable = true
      return false
    }
  }

  function handleScriptError(event: Event) {
    if (win.__choReady) return

    const target = event.target as HTMLElement | null
    if (!target || !target.tagName || target.tagName.toUpperCase() !== 'SCRIPT') {
      return
    }

    const src = target.getAttribute('src') || ''
    if (src.indexOf('/_next/static/') === -1) return
    if (recoveryScheduled) return
    if (hasUserInput()) return
    if (storageUnavailable) return
    if (hasRetryGuard()) return
    if (storageUnavailable) return
    if (!setRetryGuard()) return

    recoveryScheduled = true

    win.setTimeout(function () {
      if (win.__choReady) return
      if (hasUserInput()) return
      if (storageUnavailable) return
      if (!hasRetryGuard()) return
      if (storageUnavailable) return
      win.location.reload()
    }, recoveryDelayMs)
  }

  doc.addEventListener('input', markUserInteraction, true)
  doc.addEventListener('change', markUserInteraction, true)
  doc.addEventListener('error', handleScriptError, true)

  const watchdogTimer = win.setTimeout(function () {
    if (win.__choReady) return
    if (doc.getElementById(noticeId)) return
    if (!doc.body) return

    const notice = doc.createElement('div')
    notice.id = noticeId
    notice.setAttribute('role', 'status')
    notice.setAttribute('aria-live', 'polite')
    notice.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;max-width:40rem;margin:0 auto;padding:14px 16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:16px;box-shadow:0 4px 12px rgba(15,23,42,0.18);font-family:ui-sans-serif,system-ui,sans-serif'

    const message = doc.createElement('p')
    message.style.cssText =
      'flex:1;min-width:12rem;margin:0;font-size:14px;line-height:1.5;color:#78350f'
    message.textContent =
      'The page is taking longer than usual to load. Buttons or the calendar may remain inactive. Refresh the page to try again.'

    const refresh = doc.createElement('button')
    refresh.type = 'button'
    refresh.textContent = 'Refresh'
    refresh.style.cssText =
      'padding:8px 16px;border:0;border-radius:12px;background:#d97706;color:#fff;font-size:14px;font-weight:600;cursor:pointer'
    refresh.addEventListener('click', function () {
      win.location.reload()
    })

    notice.appendChild(message)
    notice.appendChild(refresh)
    doc.body.appendChild(notice)
  }, watchdogMs)

  win.__choClearWatchdog = function () {
    win.clearTimeout(watchdogTimer)
    const notice = doc.getElementById(noticeId)
    if (notice && notice.parentNode) notice.parentNode.removeChild(notice)
  }
}

export function markHydrated(
  win: PageHealthWindow,
  storageKey: string
): void {
  win.__choReady = true

  if (typeof win.__choClearWatchdog === 'function') {
    win.__choClearWatchdog()
  }

  try {
    win.sessionStorage.removeItem(storageKey)
  } catch {
    // Hydration still succeeded; a failed cleanup only disables future retries.
  }
}

export const PAGE_HEALTH_SCRIPT = `(${installPageHealth.toString()})(window, document, ${JSON.stringify(
  CHUNK_RECOVERY_STORAGE_KEY
)}, ${CHUNK_RECOVERY_DELAY_MS}, ${HYDRATION_WATCHDOG_MS}, ${JSON.stringify(
  LOAD_NOTICE_ID
)});`
