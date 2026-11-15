import { cn } from '@/lib/utils'

/** The Web3Ladies icon (official logo). */
export function BrandIcon({ className }: { className?: string }) {
  return <img src="/w3l-icon.png" alt="Web3Ladies" className={cn('size-9 shrink-0 object-contain', className)} />
}

/** "Web3Ladies" wordmark, styled like the Web3Ladies website header. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display font-bold tracking-tight', className)}>
      Web3<span className="text-primary">Ladies</span>
    </span>
  )
}

/** Icon + wordmark, with an optional small line underneath (e.g. "Builder Venture LMS"). */
export function BrandLockup({
  subtitle,
  className,
  iconClassName,
}: {
  subtitle?: string
  className?: string
  iconClassName?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandIcon className={cn('size-8', iconClassName)} />
      <div className="min-w-0 leading-tight">
        <Wordmark className="block text-[17px]" />
        {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  )
}
