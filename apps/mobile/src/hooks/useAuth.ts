/**
 * Auth hook — manages authentication state for the mobile app.
 * Checks token on mount, provides login/logout, user profile.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  isAuthenticated,
  getCachedUser,
  loginWithCredentials,
  loginWithGoogle,
  loginWithApple,
  logout as doLogout,
} from '@/lib/auth'
import { api } from '@/lib/api-client'
import { setCachedUser } from '@/lib/auth'
import { clearOfflineData } from '@/lib/offline'
import type { UserProfile } from '@/types'

interface AuthState {
  /** null = still checking, true/false = resolved */
  isLoggedIn: boolean | null;
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: null,
    user: null,
    isLoading: true,
    error: null,
  })

  /* Check auth status on mount */
  useEffect(() => {
    let cancelled = false

    async function check() {
      const authed = await isAuthenticated()
      if (cancelled) return

      if (!authed) {
        setState({ isLoggedIn: false, user: null, isLoading: false, error: null })
        return
      }

      /* Try cached user first for instant UI, then refresh from server */
      const cached = await getCachedUser()
      if (cancelled) return

      if (cached) {
        setState({ isLoggedIn: true, user: cached, isLoading: false, error: null })
      }

      try {
        const fresh = await api.get<UserProfile>('/api/user')
        if (cancelled) return
        await setCachedUser(fresh)
        setState({ isLoggedIn: true, user: fresh, isLoading: false, error: null })
      } catch {
        /* If fetch fails but we have cached data, keep it */
        if (cached) return
        setState({ isLoggedIn: false, user: null, isLoading: false, error: null })
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const user = await loginWithCredentials(email, password)
      setState({ isLoggedIn: true, user, isLoading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка входа'
      setState((s) => ({ ...s, isLoading: false, error: message }))
      throw err
    }
  }, [])

  const googleLogin = useCallback(async (idToken: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const user = await loginWithGoogle(idToken)
      setState({ isLoggedIn: true, user, isLoading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка входа через Google'
      setState((s) => ({ ...s, isLoading: false, error: message }))
      throw err
    }
  }, [])

  const appleLogin = useCallback(async (
    identityToken: string,
    authorizationCode: string,
    fullName?: { givenName?: string; familyName?: string },
  ) => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const user = await loginWithApple(identityToken, authorizationCode, fullName)
      setState({ isLoggedIn: true, user, isLoading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка входа через Apple'
      setState((s) => ({ ...s, isLoading: false, error: message }))
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await doLogout()
    await clearOfflineData()
    setState({ isLoggedIn: false, user: null, isLoading: false, error: null })
  }, [])

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }))
  }, [])

  return {
    ...state,
    login,
    googleLogin,
    appleLogin,
    logout,
    clearError,
  }
}
