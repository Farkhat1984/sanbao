/**
 * Hook to track online/offline status with auto-cleanup.
 */

import { useState, useEffect } from 'react'
import { isOnline, onNetworkChange } from '@/lib/offline'

export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(isOnline)

  useEffect(() => {
    return onNetworkChange(setOnline)
  }, [])

  return online
}
