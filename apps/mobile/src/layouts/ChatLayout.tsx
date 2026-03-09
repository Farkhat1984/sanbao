/**
 * Chat layout — no tab bar, full-height for individual chat screens.
 * Back navigation handled by the screen itself.
 */

import { Outlet } from 'react-router-dom'
import { OfflineBanner } from '@/components/OfflineBanner'

export function ChatLayout() {
  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <div className="safe-area-top bg-[var(--bg)]">
        <OfflineBanner />
      </div>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
