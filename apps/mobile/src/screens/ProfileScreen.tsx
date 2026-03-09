/**
 * Profile screen — user info, navigation to settings/billing, logout.
 */

import { useNavigate } from 'react-router-dom'
import {
  Settings,
  CreditCard,
  LogOut,
  ChevronRight,
  User as UserIcon,
  Shield,
} from 'lucide-react'
import { useAuth } from '@/hooks'
import { cn } from '@sanbao/shared/utils'

export default function ProfileScreen() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const menuItems = [
    {
      icon: Settings,
      label: 'Настройки',
      sublabel: 'Язык, уведомления',
      path: '/settings',
    },
    {
      icon: CreditCard,
      label: 'Подписка',
      sublabel: 'Тариф и оплата',
      path: '/billing',
    },
  ]

  return (
    <div className="scroll-container h-full px-4 py-3">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Профиль
        </h1>
      </header>

      {/* User card */}
      <div
        className={cn(
          'mb-6 flex items-center gap-4 rounded-2xl',
          'border border-[var(--border)] bg-[var(--bg-secondary)]',
          'px-4 py-4',
        )}
      >
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center',
            'rounded-full bg-[var(--accent)]',
          )}
        >
          {user?.image ? (
            <img
              src={user.image}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <UserIcon size={24} className="text-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[var(--text-primary)]">
            {user?.name ?? 'Пользователь'}
          </p>
          <p className="truncate text-sm text-[var(--text-secondary)]">
            {user?.email ?? ''}
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <Shield size={16} className="shrink-0 text-[var(--warning)]" />
        )}
      </div>

      {/* Menu */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]">
        {menuItems.map((item, i) => {
          const Icon = item.icon
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={cn(
                'flex w-full items-center gap-3.5 px-4 py-3.5',
                'text-left transition-colors',
                'active:bg-[var(--surface-hover)]',
                i < menuItems.length - 1 && 'border-b border-[var(--border)]',
              )}
            >
              <Icon size={18} className="shrink-0 text-[var(--text-secondary)]" />
              <div className="flex-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {item.label}
                </span>
                <p className="text-xs text-[var(--text-muted)]">{item.sublabel}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-[var(--text-muted)]" />
            </button>
          )
        })}
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className={cn(
          'flex w-full items-center justify-center gap-2',
          'rounded-2xl border border-[var(--border)]',
          'bg-[var(--bg-secondary)] px-4 py-3.5',
          'text-sm font-medium text-[var(--error)]',
          'active:bg-[var(--surface-hover)] transition-colors',
        )}
      >
        <LogOut size={16} />
        Выйти
      </button>

      {/* App version */}
      <p className="mt-6 text-center text-[10px] text-[var(--text-muted)]">
        Sanbao AI v0.1.0
      </p>
    </div>
  )
}
