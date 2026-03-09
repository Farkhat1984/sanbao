/**
 * Auth module for the Sanbao mobile app.
 *
 * - Email/password login via NextAuth credentials
 * - Google Sign-In via /api/auth/mobile/google
 * - Apple Sign-In via /api/auth/apple
 * - Token stored in Capacitor Preferences (persisted across restarts)
 */

import { Preferences } from '@capacitor/preferences'
import type { AuthTokens, UserProfile } from '@/types'

const TOKEN_KEY = 'sanbao_auth_token'
const USER_KEY = 'sanbao_user'

/* ─── Token Storage ───────────────────────────────────────── */

/** Retrieve the stored access token, or null if not logged in. */
export async function getToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY })
  if (!value) return null

  try {
    const tokens: AuthTokens = JSON.parse(value)
    if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
      await clearToken()
      return null
    }
    return tokens.accessToken
  } catch {
    return value /* plain string fallback */
  }
}

/** Persist access token in secure storage. */
export async function setToken(accessToken: string, expiresInMs?: number): Promise<void> {
  const tokens: AuthTokens = {
    accessToken,
    expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
  }
  await Preferences.set({ key: TOKEN_KEY, value: JSON.stringify(tokens) })
}

/** Clear stored token (logout). */
export async function clearToken(): Promise<void> {
  await Preferences.remove({ key: TOKEN_KEY })
  await Preferences.remove({ key: USER_KEY })
}

/** Check whether a valid token exists without making a network call. */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken()
  return token !== null
}

/* ─── Cached User Profile ─────────────────────────────────── */

/** Get cached user profile from Preferences. */
export async function getCachedUser(): Promise<UserProfile | null> {
  const { value } = await Preferences.get({ key: USER_KEY })
  if (!value) return null
  try {
    return JSON.parse(value) as UserProfile
  } catch {
    return null
  }
}

/** Cache user profile in Preferences. */
export async function setCachedUser(user: UserProfile): Promise<void> {
  await Preferences.set({ key: USER_KEY, value: JSON.stringify(user) })
}

/* ─── Login Methods ───────────────────────────────────────── */

const DEFAULT_BASE_URL = 'https://sanbao.ai'

function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL
}

interface LoginResponse {
  token: string;
  expiresIn?: number;
  user?: UserProfile;
}

/**
 * Email + password login.
 * Posts to the mobile credentials endpoint, receives a Bearer token.
 */
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<UserProfile> {
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, mobile: true }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Неверный email или пароль',
    )
  }

  const data = (await res.json()) as LoginResponse
  await setToken(data.token, data.expiresIn)
  if (data.user) {
    await setCachedUser(data.user)
    return data.user
  }

  /* If user not returned, fetch profile separately */
  return fetchAndCacheUser(data.token, baseUrl)
}

/**
 * Google Sign-In (mobile flow).
 * Sends the Google ID token to the backend for verification.
 */
export async function loginWithGoogle(idToken: string): Promise<UserProfile> {
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/auth/mobile/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Ошибка входа через Google',
    )
  }

  const data = (await res.json()) as LoginResponse
  await setToken(data.token, data.expiresIn)
  if (data.user) {
    await setCachedUser(data.user)
    return data.user
  }

  return fetchAndCacheUser(data.token, baseUrl)
}

/**
 * Apple Sign-In (mobile flow).
 * Sends the Apple identity token + authorization code.
 */
export async function loginWithApple(
  identityToken: string,
  authorizationCode: string,
  fullName?: { givenName?: string; familyName?: string },
): Promise<UserProfile> {
  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityToken,
      authorizationCode,
      fullName,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Ошибка входа через Apple',
    )
  }

  const data = (await res.json()) as LoginResponse
  await setToken(data.token, data.expiresIn)
  if (data.user) {
    await setCachedUser(data.user)
    return data.user
  }

  return fetchAndCacheUser(data.token, baseUrl)
}

/** Fetch user profile after login and cache it. */
async function fetchAndCacheUser(
  token: string,
  baseUrl: string,
): Promise<UserProfile> {
  const res = await fetch(`${baseUrl}/api/user`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error('Не удалось загрузить профиль')
  }

  const user = (await res.json()) as UserProfile
  await setCachedUser(user)
  return user
}

/** Logout: clear all stored auth data. */
export async function logout(): Promise<void> {
  await clearToken()
}
