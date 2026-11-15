import { Loader2 } from 'lucide-react'
import { Page } from '@/components/PageHeader'

/** Full-page spinner shown while a page loads its data. */
export function PageLoading() {
  return (
    <Page>
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    </Page>
  )
}

/** Full-page error message when a page's data fails to load. */
export function PageError({ message }: { message: string }) {
  return (
    <Page>
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {message}
      </div>
    </Page>
  )
}
