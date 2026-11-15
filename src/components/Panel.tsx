import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Rounded content card used across the app. */
export function Panel({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div'
}) {
  return (
    <Tag className={cn('rounded-2xl border border-border bg-card p-5 shadow-sm', className)}>
      {children}
    </Tag>
  )
}

/** Panel title row: primary-coloured icon + title, optional action on the right. */
export function PanelHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 shrink-0 text-primary" />}
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Small primary text link used in panel headers ("View all", "Open project"). */
export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="shrink-0 text-xs font-medium text-primary hover:underline">
      {children}
    </Link>
  )
}

/** Bordered list row inside a panel. */
export function PanelItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cn('rounded-lg border border-border bg-background/60 p-3', className)}>
      {children}
    </li>
  )
}

/** Muted placeholder shown when a panel has nothing to list. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** Rounded pill for stages / statuses. */
export function Pill({
  children,
  tone = 'accent',
  className,
}: {
  children: ReactNode
  tone?: 'accent' | 'muted' | 'success' | 'warning' | 'destructive'
  className?: string
}) {
  const tones = {
    accent: 'bg-accent text-accent-foreground',
    muted: 'bg-muted text-muted-foreground',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/20 text-warning-foreground',
    destructive: 'bg-destructive/10 text-destructive',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
