'use client'

import { useEffect, useRef, useState } from 'react'
import { TURNSTILE_ACTION } from '@/constants/turnstile'

/**
 * Cloudflare Turnstile widget for the public booking form.
 *
 * The widget renders only when a site key is configured for the deployment.
 * The secret key never reaches the browser: the token produced here is
 * exchanged for a verification on the server.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      action?: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
      theme?: 'light' | 'dark' | 'auto'
      size?: 'normal' | 'compact' | 'flexible'
    }
  ) => string
  remove: (widgetId?: string) => void
  reset: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

interface TurnstileWidgetProps {
  onToken: (token: string | null) => void
}

export default function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return

    let cancelled = false

    const render = () => {
      if (cancelled || !containerRef.current) return
      if (!window.turnstile) {
        // The script loaded but the API is unavailable, for example because a
        // content security policy blocked it. Surface it instead of leaving
        // the patient with an empty widget.
        setFailed(true)
        return
      }
      if (widgetIdRef.current) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        action: TURNSTILE_ACTION,
        callback: token => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => {
          setFailed(true)
          onToken(null)
        },
        theme: 'light',
        size: 'flexible',
      })
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      if (window.turnstile) render()
      else existing.addEventListener('load', render, { once: true })
    } else {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.addEventListener('load', render, { once: true })
      script.addEventListener('error', () => setFailed(true), { once: true })
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // The widget is already gone.
        }
        widgetIdRef.current = null
      }
    }
  }, [onToken])

  if (!SITE_KEY) return null

  return (
    <div className="space-y-2">
      <div ref={containerRef} aria-label="Human verification" />
      {failed ? (
        <p className="text-xs font-medium text-red-700">
          Human verification could not be loaded. Please refresh the page and try again.
        </p>
      ) : null}
    </div>
  )
}
