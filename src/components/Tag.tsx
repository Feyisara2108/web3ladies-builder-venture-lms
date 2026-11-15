import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TagTone = 'green' | 'blue' | 'purple' | 'amber' | 'red' | 'muted' | 'primary'

const tones: Record<TagTone, string> = {
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  red: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
}

/** Small coloured status / role / stage label used in tables. */
export function Tag({
  tone = 'muted',
  children,
  className,
}: {
  tone?: TagTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
