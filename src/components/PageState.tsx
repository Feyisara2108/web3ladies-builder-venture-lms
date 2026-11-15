import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Centred spinner for a page (or section) that is still loading. */
export function PageLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex min-h-[40vh] items-center justify-center', className)}>
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/** Inline error panel. */
export function PageError({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
      {children}
    </div>
  )
}

/** "Back to X" text link shown above detail pages. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {children}
    </Link>
  )
}

/** Centred "not found" block for detail pages. */
export function NotFoundState({
  icon: Icon,
  title,
  description,
  backTo,
  backLabel,
}: {
  icon?: LucideIcon
  title: string
  description: ReactNode
  backTo: string
  backLabel: string
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-6 py-16 text-center">
      {Icon && (
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </div>
      )}
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link
        to={backTo}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>
    </div>
  )
}

/** Small label/value tile used on detail pages (Role, Cohort, Status…). */
export function InfoTile({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 shadow-sm', className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-medium">{value}</div>
    </div>
  )
}
