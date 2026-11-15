import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandIcon, Wordmark } from '@/components/BrandLogo'

/** Shared frame for the sign-in, password and join screens. */
export function AuthLayout({
  title = 'Builder Venture LMS',
  subtitle,
  children,
  footer,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="mx-auto mb-6 inline-flex items-center gap-2.5" aria-label="Back to home">
            <BrandIcon className="size-9" />
            <Wordmark className="text-xl" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">{children}</div>
        {footer && <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>}
        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Error banner used inside auth forms. */
export function AuthError({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>
}
