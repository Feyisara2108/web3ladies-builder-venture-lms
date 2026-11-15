import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bordered table with a muted uppercase header row.
 * `framed` wraps it in its own card; set false when it sits inside a Panel.
 */
export function DataTable({
  head,
  children,
  framed = true,
  compact = false,
}: {
  head: { label: ReactNode; align?: 'left' | 'right' }[]
  children: ReactNode
  framed?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        framed
          ? 'rounded-2xl border border-border bg-card shadow-sm'
          : 'overflow-hidden rounded-xl border border-border',
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {head.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 font-medium whitespace-nowrap',
                    compact ? 'py-2.5' : 'py-3',
                    h.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('hover:bg-muted/30', className)}>{children}</tr>
}

export function Td({
  children,
  className,
  muted = false,
  strong = false,
  align,
  compact = false,
}: {
  children?: ReactNode
  className?: string
  muted?: boolean
  strong?: boolean
  align?: 'left' | 'right'
  compact?: boolean
}) {
  return (
    <td
      className={cn(
        'px-4 align-top',
        compact ? 'py-2.5' : 'py-3',
        muted && 'text-muted-foreground',
        strong && 'font-medium',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </td>
  )
}

/** Full-width placeholder row ("No cohorts match your search."). */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  )
}

/** Small bordered "View X →" link used in table action columns. */
export function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
    >
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  )
}
