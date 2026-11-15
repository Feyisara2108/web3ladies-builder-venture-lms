import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const tones = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning-foreground',
  destructive: 'bg-destructive/10 text-destructive',
}

/** Summary card with a tinted icon chip and a large count (Students / Reviews pages). */
export function ToneStatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: keyof typeof tones
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={cn('flex size-7 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-4" />
        </span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold leading-tight">{value}</div>
    </div>
  )
}
