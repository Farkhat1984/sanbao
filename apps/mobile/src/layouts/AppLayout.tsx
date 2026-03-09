/**
 * Main app layout with bottom tab bar and safe area handling.
 * Wraps all authenticated screens.
 */

import { Outlet } from 'react-router-dom'
import { TabBar } from '@/components/TabBar'
import { OfflineBanner } from '@/components/OfflineBanner'

export function AppLayout() {
  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      {/* Safe area top + offline banner */}
      <div className="safe-area-top bg-[var(--bg)]">
        <OfflineBanner />
      </div>

      {/* Main content area (scrollable per-screen) */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <TabBar />
    </div>
  )
}
