import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Card whose title has a tinted icon chip, used on the mentor detail pages. */
export function IconSection({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: ReactNode
  icon: LucideIcon
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/** Label + value row inside an IconSection. */
export function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm break-words">{children}</div>
      </div>
    </div>
  )
}

/** Small bordered block with an uppercase label (progress update fields). */
export function FieldBlock({
  label,
  tone = 'default',
  children,
}: {
  label: string
  tone?: 'default' | 'warn'
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p
        className={cn(
          'text-[10px] font-medium uppercase tracking-wide',
          tone === 'warn' ? 'text-warning-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  )
}
