/**
 * @vitest-environment jsdom
 */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SCRIPT_ID = 'cf-turnstile-script'

interface RenderOptions {
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

let container: HTMLDivElement
let root: Root | undefined
let renderOptions: RenderOptions | null
let scriptElement: HTMLScriptElement
let turnstileApi: {
  render: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key')

  document.head.innerHTML = ''
  document.body.innerHTML = ''

  scriptElement = document.createElement('script')
  scriptElement.id = SCRIPT_ID
  document.head.appendChild(scriptElement)

  renderOptions = null
  turnstileApi = {
    render: vi.fn((_element: HTMLElement, options: RenderOptions) => {
      renderOptions = options
      return 'widget-id'
    }),
    remove: vi.fn(),
    reset: vi.fn(),
  }

  Object.defineProperty(window, 'turnstile', {
    configurable: true,
    writable: true,
    value: turnstileApi,
  })

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
  container?.remove()
  delete (window as { turnstile?: unknown }).turnstile
  vi.unstubAllEnvs()
})

async function mountWidget(onToken: (token: string | null) => void) {
  const { default: TurnstileWidget } = await import('@/components/TurnstileWidget')

  function Harness() {
    const [resetKey, setResetKey] = useState(0)

    return createElement(
      'div',
      null,
      createElement(TurnstileWidget, { onToken, resetKey }),
      createElement(
        'button',
        { id: 'bump-reset', onClick: () => setResetKey(key => key + 1) },
        'Reset',
      ),
    )
  }

  act(() => {
    root?.render(createElement(Harness))
  })
}

async function clickReset() {
  const button = container.querySelector('#bump-reset')
  if (!button) throw new Error('Reset button was not rendered')

  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })
}

describe('TurnstileWidget reset handling', () => {
  it('resets the rendered widget and clears the old token when resetKey changes', async () => {
    const onToken = vi.fn()
    await mountWidget(onToken)

    expect(turnstileApi.render).toHaveBeenCalledTimes(1)
    expect(turnstileApi.reset).not.toHaveBeenCalled()

    act(() => {
      renderOptions?.callback('first-token')
    })
    expect(onToken).toHaveBeenLastCalledWith('first-token')

    await clickReset()

    expect(turnstileApi.reset).toHaveBeenCalledWith('widget-id')
    expect(onToken).toHaveBeenCalledWith(null)
    expect(turnstileApi.render).toHaveBeenCalledTimes(1)
    expect(turnstileApi.remove).not.toHaveBeenCalled()
    expect(document.getElementById(SCRIPT_ID)).toBe(scriptElement)
    expect(document.head.contains(scriptElement)).toBe(true)
  })

  it('clears a previous failure after the widget resets successfully', async () => {
    const onToken = vi.fn()
    await mountWidget(onToken)

    act(() => {
      renderOptions?.['error-callback']()
    })
    expect(container.textContent).toContain('Human verification could not be loaded')

    await clickReset()

    expect(turnstileApi.reset).toHaveBeenCalledWith('widget-id')
    expect(container.textContent).not.toContain('Human verification could not be loaded')
  })

  it('keeps the failure visible and clears the token when reset throws', async () => {
    const onToken = vi.fn()
    await mountWidget(onToken)

    act(() => {
      renderOptions?.['error-callback']()
    })
    turnstileApi.reset.mockImplementation(() => {
      throw new Error('widget is gone')
    })

    await clickReset()

    expect(onToken).toHaveBeenCalledWith(null)
    expect(container.textContent).toContain('Human verification could not be loaded')
  })
})
