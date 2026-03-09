/**
 * Bottom tab bar for mobile navigation.
 * Three tabs: Chats, Agents, Profile.
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { MessageSquare, Bot, User } from 'lucide-react'
import { cn } from '@sanbao/shared/utils'

interface TabItem {
  path: string;
  matchPaths: string[];
  label: string;
  icon: typeof MessageSquare;
}

const TABS: TabItem[] = [
  {
    path: '/chat',
    matchPaths: ['/chat', '/chat/'],
    label: 'Чаты',
    icon: MessageSquare,
  },
  {
    path: '/agents',
    matchPaths: ['/agents'],
    label: 'Агенты',
    icon: Bot,
  },
  {
    path: '/profile',
    matchPaths: ['/profile', '/settings', '/billing'],
    label: 'Профиль',
    icon: User,
  },
]

export function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  function isActive(tab: TabItem): boolean {
    return tab.matchPaths.some((p) => location.pathname.startsWith(p))
  }

  return (
    <nav
      className={cn(
        'flex items-center justify-around',
        'border-t border-[var(--border)]',
        'bg-[var(--bg-secondary)]',
        'safe-area-bottom',
      )}
      style={{ paddingBottom: 'var(--safe-area-bottom)' }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab)
        const Icon = tab.icon

        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            className={cn(
              'flex flex-col items-center justify-center',
              'flex-1 py-2 pt-3',
              'transition-colors duration-150',
              active
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)]',
            )}
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.2 : 1.8}
            />
            <span className="mt-0.5 text-[10px] font-medium">
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
