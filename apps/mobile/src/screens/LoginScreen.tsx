/**
 * Login screen — email/password + social sign-in (Google, Apple).
 */

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks'
import { cn } from '@sanbao/shared/utils'

export default function LoginScreen() {
  const navigate = useNavigate()
  const { login, googleLogin, appleLogin, isLoading, error, clearError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return

    try {
      await login(email.trim(), password)
      navigate('/chat', { replace: true })
    } catch {
      /* Error is set in useAuth state */
    }
  }

  async function handleGoogleLogin() {
    /* In production, this would use @capacitor-community/google-auth
       to get the ID token. For now, this is a placeholder. */
    try {
      const idToken = '' /* GoogleAuth.signIn() → .authentication.idToken */
      if (!idToken) return
      await googleLogin(idToken)
      navigate('/chat', { replace: true })
    } catch {
      /* Error handled in useAuth */
    }
  }

  async function handleAppleLogin() {
    /* In production, this would use @capacitor-community/apple-sign-in.
       For now, this is a placeholder. */
    try {
      const identityToken = ''
      const authorizationCode = ''
      if (!identityToken) return
      await appleLogin(identityToken, authorizationCode)
      navigate('/chat', { replace: true })
    } catch {
      /* Error handled in useAuth */
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Sanbao AI
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          AI-платформа для профессионалов
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className={cn(
            'mb-4 w-full rounded-xl px-4 py-3',
            'bg-[var(--error)]/10 text-sm text-[var(--error)]',
          )}
          role="alert"
        >
          {error}
          <button
            type="button"
            onClick={clearError}
            className="ml-2 underline"
          >
            Скрыть
          </button>
        </div>
      )}

      {/* Credentials form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {/* Email */}
        <div className="relative">
          <Mail
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              'w-full rounded-xl border border-[var(--border)]',
              'bg-[var(--bg-secondary)] py-3.5 pl-11 pr-4',
              'text-[var(--text-primary)] placeholder-[var(--text-muted)]',
              'focus:border-[var(--accent)] focus:outline-none',
              'transition-colors',
            )}
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Пароль"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(
              'w-full rounded-xl border border-[var(--border)]',
              'bg-[var(--bg-secondary)] py-3.5 pl-11 pr-11',
              'text-[var(--text-primary)] placeholder-[var(--text-muted)]',
              'focus:border-[var(--accent)] focus:outline-none',
              'transition-colors',
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !email.trim() || !password.trim()}
          className={cn(
            'w-full rounded-xl py-3.5 text-sm font-semibold',
            'bg-[var(--accent)] text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'active:scale-[0.98] transition-transform',
          )}
        >
          {isLoading ? 'Вход...' : 'Войти'}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex w-full max-w-sm items-center gap-3">
        <div className="flex-1 border-t border-[var(--border)]" />
        <span className="text-xs text-[var(--text-muted)]">или</span>
        <div className="flex-1 border-t border-[var(--border)]" />
      </div>

      {/* Social buttons */}
      <div className="w-full max-w-sm space-y-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className={cn(
            'flex w-full items-center justify-center gap-3',
            'rounded-xl border border-[var(--border)]',
            'bg-[var(--bg-secondary)] py-3.5',
            'text-sm font-medium text-[var(--text-primary)]',
            'active:bg-[var(--surface-hover)] transition-colors',
            'disabled:opacity-50',
          )}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Войти через Google
        </button>

        <button
          type="button"
          onClick={handleAppleLogin}
          disabled={isLoading}
          className={cn(
            'flex w-full items-center justify-center gap-3',
            'rounded-xl border border-[var(--border)]',
            'bg-[var(--bg-secondary)] py-3.5',
            'text-sm font-medium text-[var(--text-primary)]',
            'active:bg-[var(--surface-hover)] transition-colors',
            'disabled:opacity-50',
          )}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.45-3.74 4.25z" />
          </svg>
          Войти через Apple
        </button>
      </div>
    </div>
  )
}
