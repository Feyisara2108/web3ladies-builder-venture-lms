import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, FolderKanban, Layers, Loader2, Plus, Users } from 'lucide-react'
import { Page, PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { DataTable, EmptyRow, RowLink, Td, Tr } from '@/components/DataTable'
import { SearchInput, SegmentedFilter } from '@/components/ListControls'
import { PageError, PageLoading } from '@/components/PageState'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createCohort, listCohorts, listUsers } from '@/data/queries'
import { formatDate, todayForDateInput } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Cohort, CohortStatus, User } from '@/types'
import { cohortStatusTone } from './helpers'

const FILTERS: { id: 'all' | CohortStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
]

const EMPTY_FORM = { name: '', programme: '', start_date: '', end_date: '' }

export function AdminCohorts() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cohorts, setCohorts] = React.useState<Cohort[]>([])
  const [mentors, setMentors] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<'all' | CohortStatus>('all')

  // ?new=1 opens the create dialog (dashboard quick action).
  const [open, setOpen] = React.useState(searchParams.has('new'))
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next && searchParams.has('new')) {
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }

  React.useEffect(() => {
    let cancelled = false
    Promise.all([listCohorts(), listUsers()])
      .then(([cohortData, userData]) => {
        if (cancelled) return
        setCohorts(cohortData)
        setMentors(userData.filter((u) => u.role === 'mentor'))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load cohorts'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.start_date || !form.end_date) return
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await createCohort({
        name: form.name,
        programme: form.programme || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
      })
      setCohorts((prev) => [created, ...prev])
      setForm(EMPTY_FORM)
      handleOpenChange(false)
      showToast('Cohort created')
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to create cohort'))
    } finally {
      setSubmitting(false)
    }
  }

  const counts = {
    total: cohorts.length,
    active: cohorts.filter((c) => c.status === 'active').length,
    completed: cohorts.filter((c) => c.status === 'completed').length,
    upcoming: cohorts.filter((c) => c.status === 'upcoming').length,
  }

  const q = query.trim().toLowerCase()
  const visible = cohorts.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false
    if (q && !c.name.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <Page>
      <PageHeader
        eyebrow="Administrator"
        title="Cohorts"
        description="View and manage all programme cohorts."
        action={
          <Button className="rounded-lg px-3" onClick={() => handleOpenChange(true)}>
            <Plus className="size-4" /> Create Cohort
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create cohort</DialogTitle>
            <DialogDescription>Set up a new Builder Venture cohort.</DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={handleCreate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cohort-name">Name</Label>
              <Input
                id="cohort-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="AI x Web3 Builder Venture — Cohort 5"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cohort-programme">Programme (optional)</Label>
              <Input
                id="cohort-programme"
                value={form.programme}
                onChange={(e) => setForm((f) => ({ ...f, programme: e.target.value }))}
                placeholder="Builder Venture"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start-date">Start date</Label>
                <Input
                  id="start-date"
                  type="date"
                  min={todayForDateInput()}
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end-date">End date</Label>
                <Input
                  id="end-date"
                  type="date"
                  min={form.start_date || todayForDateInput()}
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Create cohort
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {loading && <PageLoading />}
      {!loading && loadError && <PageError>{loadError}</PageError>}

      {!loading && !loadError && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Layers} label="Total Cohorts" value={counts.total} hint="All statuses" />
            <StatCard icon={CheckCircle2} label="Active Cohorts" value={counts.active} hint="Running now" />
            <StatCard icon={FolderKanban} label="Completed Cohorts" value={counts.completed} hint="Delivered" />
            <StatCard icon={Clock} label="Upcoming Cohorts" value={counts.upcoming} hint="Not yet started" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search cohort name…" />
            <SegmentedFilter options={FILTERS} value={filter} onChange={setFilter} />
          </div>

          <DataTable
            head={[
              { label: 'Cohort Name' },
              { label: 'Programme' },
              { label: 'Start' },
              { label: 'End' },
              { label: 'Students' },
              { label: 'Mentors' },
              { label: 'Status' },
              { label: 'Action', align: 'right' },
            ]}
          >
            {visible.map((c) => {
              const names = mentors
                .filter((m) => m.cohort_id === c.id)
                .map((m) => m.full_name)
                .join(', ')
              return (
                <Tr key={c.id}>
                  <Td strong>{c.name}</Td>
                  <Td muted>{c.programme ?? '—'}</Td>
                  <Td muted className="whitespace-nowrap">
                    {formatDate(c.start_date)}
                  </Td>
                  <Td muted className="whitespace-nowrap">
                    {formatDate(c.end_date)}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="size-3.5" />
                      {c.student_count}
                    </span>
                  </Td>
                  <Td muted>
                    <div className="max-w-[220px] truncate" title={names}>
                      {names || '—'}
                    </div>
                  </Td>
                  <Td>
                    <Tag tone={cohortStatusTone[c.status]} className="capitalize">
                      {c.status}
                    </Tag>
                  </Td>
                  <Td align="right">
                    <RowLink to={`/admin/cohorts/${c.id}`}>View Cohort</RowLink>
                  </Td>
                </Tr>
              )
            })}
            {visible.length === 0 && (
              <EmptyRow colSpan={8}>
                {cohorts.length === 0 ? 'No cohorts yet — create the first one.' : 'No cohorts match your search.'}
              </EmptyRow>
            )}
          </DataTable>
        </>
      )}
    </Page>
  )
}
