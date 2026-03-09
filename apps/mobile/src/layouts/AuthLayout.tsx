/**
 * Auth layout — no tab bar, centered content with safe areas.
 * Used for login/register screens.
 */

import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex h-full flex-col bg-[var(--bg)] safe-area-top safe-area-bottom">
      <main className="scroll-container flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
