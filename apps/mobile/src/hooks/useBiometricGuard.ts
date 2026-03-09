/**
 * Hook that manages biometric lock state.
 *
 * When biometric lock is enabled in settings, the app will prompt
 * for biometric authentication when resuming from background.
 */

import { useState, useEffect, useCallback } from 'react'
import { App as CapApp } from '@capacitor/app'
import {
  checkBiometricAvailability,
  authenticateWithBiometrics,
  isBiometricEnabled,
} from '@/lib/biometrics'

interface BiometricGuardState {
  /** Whether the screen is currently locked (awaiting biometric) */
  isLocked: boolean;
  /** Whether biometric hardware is available on this device */
  isAvailable: boolean;
  /** Manually trigger biometric prompt (e.g. retry button) */
  unlock: () => Promise<void>;
}

/**
 * Manages biometric lock/unlock lifecycle.
 *
 * - On mount: checks if biometric is enabled and available
 * - On app resume (from background): locks the screen if enabled
 * - Prompts biometric authentication to unlock
 */
export function useBiometricGuard(): BiometricGuardState {
  const [isLocked, setIsLocked] = useState(false)
  const [isAvailable, setIsAvailable] = useState(false)

  const unlock = useCallback(async () => {
    const success = await authenticateWithBiometrics(
      'Разблокируйте Sanbao AI',
    )
    if (success) {
      setIsLocked(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    /* Check availability on mount */
    checkBiometricAvailability().then((result) => {
      if (mounted) {
        setIsAvailable(result.available)
      }
    })

    /* Listen for app state changes */
    const listener = CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (!mounted) return

      if (isActive) {
        /* App resumed — check if we need to lock */
        const [enabled, availability] = await Promise.all([
          isBiometricEnabled(),
          checkBiometricAvailability(),
        ])

        if (enabled && availability.available) {
          setIsLocked(true)
          /* Auto-prompt biometric */
          const success = await authenticateWithBiometrics(
            'Разблокируйте Sanbao AI',
          )
          if (mounted && success) {
            setIsLocked(false)
          }
        }
      }
    })

    return () => {
      mounted = false
      listener.then((handle) => handle.remove()).catch(() => {
        /* Ignore */
      })
    }
  }, [])

  return { isLocked, isAvailable, unlock }
}
