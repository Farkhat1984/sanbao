/**
 * Slim banner that appears at the top when the device is offline.
 */

import { WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/hooks'
import { cn } from '@sanbao/shared/utils'

export function OfflineBanner() {
  const online = useNetworkStatus()

  if (online) return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2',
        'bg-[var(--warning)] px-3 py-1.5',
        'text-xs font-medium text-[var(--bg)]',
      )}
    >
      <WifiOff size={14} />
      <span>Нет соединения</span>
    </div>
  )
}
