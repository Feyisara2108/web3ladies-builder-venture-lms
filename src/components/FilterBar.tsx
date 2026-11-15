import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Row of pill filter buttons plus a search box (Students / Reviews pages). */
export function FilterBar<K extends string>({
  filters,
  value,
  onChange,
  query,
  onQueryChange,
  placeholder,
}: {
  filters: { key: K; label: string; count?: number }[]
  value: K
  onChange: (key: K) => void
  query: string
  onQueryChange: (q: string) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = value === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onChange(f.key)}
              aria-pressed={active}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
              {f.count !== undefined && <span className="ml-1 opacity-70">{f.count}</span>}
            </button>
          )
        })}
      </div>
      <div className="relative w-full lg:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-card py-2 pr-3 pl-9 text-sm outline-none focus:border-primary"
        />
      </div>
    </div>
  )
}
