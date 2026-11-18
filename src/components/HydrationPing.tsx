'use client'

import { useEffect } from 'react'
import { CHUNK_RECOVERY_STORAGE_KEY, markHydrated } from '@/lib/pageHealth'

declare global {
  interface Window {
    __choReady?: boolean
    __choClearWatchdog?: () => void
  }
}

export default function HydrationPing() {
  useEffect(() => {
    markHydrated(window, CHUNK_RECOVERY_STORAGE_KEY)
  }, [])

  return null
}
