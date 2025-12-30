'use client'

import { cn } from '@/lib/utils'
import type { PresenceStatus } from '@/hooks/useTeamPresence'

type PresenceIndicatorProps = {
  status: PresenceStatus
  size?: 'sm' | 'md' | 'lg'
  showPulse?: boolean
  className?: string
}

export function PresenceIndicator({
  status,
  size = 'md',
  showPulse = true,
  className,
}: PresenceIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  }

  const colorClasses = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  }

  return (
    <span className={cn('relative flex', className)}>
      <span
        className={cn(
          'rounded-full',
          sizeClasses[size],
          colorClasses[status]
        )}
      />
      {showPulse && status === 'online' && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            colorClasses[status]
          )}
        />
      )}
    </span>
  )
}
