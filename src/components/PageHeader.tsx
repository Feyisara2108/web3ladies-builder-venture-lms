import type { ReactNode } from 'react'

/**
 * Page title block: small uppercase eyebrow, large heading, muted
 * description, and an optional element (button, date chip…) on the right.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {action}
    </div>
  )
}

/** Small bordered chip for the right side of a page header, e.g. "Cohort ends · Aug 15". */
export function HeaderChip({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

/** Standard page width and spacing. Every page renders inside this. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">{children}</div>
}
