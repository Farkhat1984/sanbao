/**
 * Biometric authentication for the Sanbao mobile app.
 *
 * MVP approach:
 * - Uses the native BiometricAuth plugin via Capacitor
 * - Stores biometric preference in Capacitor Preferences
 * - Gracefully degrades when biometric hardware is not available
 */

import { Preferences } from '@capacitor/preferences'

const BIOMETRIC_ENABLED_KEY = 'sanbao_biometric_enabled'

/* ─── Types ────────────────────────────────────────────────── */

type BiometricType = 'face' | 'fingerprint' | 'iris' | null

interface BiometricAvailability {
  available: boolean;
  type: BiometricType;
}

/* ─── Native Plugin Bridge ─────────────────────────────────── */

/**
 * Thin wrapper around the native biometric plugin.
 *
 * Uses the Capacitor Plugins global to call the native BiometricAuth plugin.
 * Falls back gracefully when running in browser or when the plugin is not installed.
 */
async function getNativeBiometrics(): Promise<{
  checkAvailability: () => Promise<{ isAvailable: boolean; biometryType: number }>;
  authenticate: (options: { reason: string; title: string; cancelTitle: string }) => Promise<void>;
} | null> {
  try {
    /* Dynamic import to avoid build errors when plugin is not installed */
    const { NativeBiometric } = await import('capacitor-native-biometric')
    return NativeBiometric as {
      checkAvailability: () => Promise<{ isAvailable: boolean; biometryType: number }>;
      authenticate: (options: { reason: string; title: string; cancelTitle: string }) => Promise<void>;
    }
  } catch {
    return null
  }
}

/**
 * Map numeric biometry type from native plugin to our type.
 * Common values: 1 = fingerprint, 2 = face, 3 = iris
 */
function mapBiometryType(type: number): BiometricType {
  switch (type) {
    case 1: return 'fingerprint'
    case 2: return 'face'
    case 3: return 'iris'
    default: return null
  }
}

/* ─── Public API ───────────────────────────────────────────── */

/**
 * Check whether biometric authentication is available on the device.
 *
 * Returns the type of biometric hardware (face, fingerprint, iris)
 * or null if none is available.
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const biometric = await getNativeBiometrics()
    if (!biometric) {
      return { available: false, type: null }
    }

    const result = await biometric.checkAvailability()
    return {
      available: result.isAvailable,
      type: result.isAvailable ? mapBiometryType(result.biometryType) : null,
    }
  } catch {
    return { available: false, type: null }
  }
}

/**
 * Prompt the user for biometric authentication (Face ID / Touch ID / Fingerprint).
 *
 * @param reason - Reason text shown to the user
 * @returns true if authenticated successfully, false otherwise
 */
export async function authenticateWithBiometrics(
  reason = 'Подтвердите вашу личность',
): Promise<boolean> {
  try {
    const biometric = await getNativeBiometrics()
    if (!biometric) return false

    await biometric.authenticate({
      reason,
      title: 'Sanbao AI',
      cancelTitle: 'Отмена',
    })
    return true
  } catch {
    /* User cancelled or authentication failed */
    return false
  }
}

/**
 * Get the user-friendly label for the biometric type.
 */
export function getBiometricLabel(type: BiometricType): string {
  switch (type) {
    case 'face': return 'Face ID'
    case 'fingerprint': return 'Touch ID / Отпечаток'
    case 'iris': return 'Сканер радужки'
    default: return 'Биометрия'
  }
}

/* ─── Preference Storage ───────────────────────────────────── */

/**
 * Check if the user has enabled biometric lock.
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY })
  return value === 'true'
}

/**
 * Enable or disable biometric lock.
 * When enabling, verifies biometric first.
 *
 * @returns true if the preference was changed, false if biometric verification failed
 */
export async function setBiometricEnabled(enabled: boolean): Promise<boolean> {
  if (enabled) {
    /* Verify biometric before enabling */
    const success = await authenticateWithBiometrics(
      'Подтвердите для включения биометрической блокировки',
    )
    if (!success) return false
  }

  await Preferences.set({
    key: BIOMETRIC_ENABLED_KEY,
    value: enabled ? 'true' : 'false',
  })
  return true
}
