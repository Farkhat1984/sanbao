/**
 * App root — React Router with auth guards and layout routing.
 *
 * All screens are lazy-loaded via React.lazy() to keep the initial
 * bundle small. LoadingScreen serves as the Suspense fallback.
 *
 * Routes:
 *   /login        — LoginScreen (AuthLayout)
 *   /chat         — ChatListScreen (AppLayout, tab bar)
 *   /chat/new     — ChatScreen (ChatLayout, no tab bar)
 *   /chat/:id     — ChatScreen (ChatLayout, no tab bar)
 *   /agents       — AgentListScreen (AppLayout, tab bar)
 *   /agents/:id   — AgentDetailScreen (ChatLayout, no tab bar)
 *   /profile      — ProfileScreen (AppLayout, tab bar)
 *   /settings     — SettingsScreen (ChatLayout, no tab bar)
 *   /billing      — BillingScreen (ChatLayout, no tab bar)
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { SplashScreen } from '@capacitor/splash-screen'
import { App as CapApp } from '@capacitor/app'
import { AppLayout, AuthLayout, ChatLayout } from '@/layouts'
import { LoadingScreen } from '@/components'
import { useAuth, useBiometricGuard } from '@/hooks'
import { setupDeepLinks, handleInitialDeepLink } from '@/lib/deep-links'

/* ─── Lazy-loaded screens ───────────────────────────────── */

const LoginScreen = lazy(() => import('./screens/LoginScreen'))
const ChatListScreen = lazy(() => import('./screens/ChatListScreen'))
const ChatScreen = lazy(() => import('./screens/ChatScreen'))
const AgentListScreen = lazy(() => import('./screens/AgentListScreen'))
const AgentDetailScreen = lazy(() => import('./screens/AgentDetailScreen'))
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'))
const BillingScreen = lazy(() => import('./screens/BillingScreen'))

export function App() {
  return (
    <BrowserRouter>
      <CapacitorInit />
      <BiometricLockScreen />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Auth routes (no tab bar) */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<GuestOnly><LoginScreen /></GuestOnly>} />
          </Route>

          {/* Main app with tab bar */}
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/chat" element={<ChatListScreen />} />
            <Route path="/agents" element={<AgentListScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
          </Route>

          {/* Full-screen routes (no tab bar) */}
          <Route element={<RequireAuth><ChatLayout /></RequireAuth>}>
            <Route path="/chat/new" element={<ChatScreen />} />
            <Route path="/chat/:id" element={<ChatScreen />} />
            <Route path="/agents/:id" element={<AgentDetailScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/billing" element={<BillingScreen />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

/* ─── Auth Guards ─────────────────────────────────────────── */

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth()
  const location = useLocation()

  if (isLoggedIn === null) {
    return <LoadingScreen />
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth()

  if (isLoggedIn === null) {
    return <LoadingScreen />
  }

  if (isLoggedIn) {
    return <Navigate to="/chat" replace />
  }

  return <>{children}</>
}

/* ─── Capacitor Initialization ────────────────────────────── */

function CapacitorInit() {
  const navigate = useNavigate()

  useEffect(() => {
    /* Hide splash screen once app is mounted */
    SplashScreen.hide().catch(() => {
      /* Ignore — not running in native context */
    })

    /* Handle Android back button */
    const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
      } else {
        CapApp.exitApp()
      }
    })

    /* Deep links — handles sanbao://, https://sanbao.ai/*, article:// */
    const cleanupDeepLinks = setupDeepLinks(navigate)

    /* Check if app was cold-started via a deep link */
    handleInitialDeepLink(navigate)

    return () => {
      backListener.then((l) => l.remove())
      cleanupDeepLinks()
    }
  }, [navigate])

  return null
}

/* ─── Biometric Lock Overlay ─────────────────────────────── */

function BiometricLockScreen() {
  const { isLocked, unlock } = useBiometricGuard()

  if (!isLocked) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-primary)]">
      <div className="mb-6 text-4xl">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
        Приложение заблокировано
      </h2>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        Подтвердите вашу личность
      </p>
      <button
        type="button"
        onClick={unlock}
        className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white active:opacity-80"
      >
        Разблокировать
      </button>
    </div>
  )
}
