import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CalendarPlus, CheckCircle2, ClipboardCheck, Clock, Pencil } from 'lucide-react'
import { Page, PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { DataTable, EmptyRow, RowLink, Td, Tr } from '@/components/DataTable'
import { SearchInput, SegmentedFilter } from '@/components/ListControls'
import { PageError, PageLoading } from '@/components/PageState'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import { listCohorts, listSessions, listUsers } from '@/data/queries'
import { listAllAttendance } from '@/data/queries-admin'
import { getErrorMessage } from '@/lib/utils'
import type { Cohort, Session, SessionStatus, User } from '@/types'
import { formatSessionDate, formatSessionTime, sessionStatusLabel, sessionStatusTone } from './helpers'
import { SessionDialog } from './SessionDialog'

type FilterId = 'all' | SessionStatus

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Upcoming' },
  { id: 'active', label: 'Live' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function AdminSessions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [cohorts, setCohorts] = React.useState<Cohort[]>([])
  const [users, setUsers] = React.useState<User[]>([])
  const [sessionsWithAttendance, setSessionsWithAttendance] = React.useState<Set<string>>(new Set())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<FilterId>('all')

  // ?new=1 opens the create dialog (dashboard quick action).
  const [createOpen, setCreateOpen] = React.useState(searchParams.has('new'))
  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open)
    if (!open && searchParams.has('new')) {
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }

  React.useEffect(() => {
    let cancelled = false
    Promise.all([listSessions(), listCohorts(), listUsers(), listAllAttendance()])
      .then(([sessionData, cohortData, userData, attendanceData]) => {
        if (cancelled) return
        setSessions(sessionData)
        setCohorts(cohortData)
        setUsers(userData)
        setSessionsWithAttendance(new Set(attendanceData.map((a) => a.session_id)))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load sessions'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const facilitators = React.useMemo(
    () => users.filter((u) => u.role === 'mentor' || u.role === 'admin'),
    [users],
  )

  function handleSaved(saved: Session) {
    setSessions((prev) =>
      prev.some((s) => s.id === saved.id) ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved],
    )
  }

  const now = Date.now()
  const counts = {
    total: sessions.length,
    upcoming: sessions.filter((s) => s.status === 'scheduled' && new Date(s.start_time).getTime() >= now).length,
    completed: sessions.filter((s) => s.status === 'completed').length,
    attendance: sessions.filter((s) => sessionsWithAttendance.has(s.id)).length,
  }

  const q = query.trim().toLowerCase()
  const visible = [...sessions]
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false
      if (q && !s.title.toLowerCase().includes(q)) return false
      return true
    })

  return (
    <Page>
      <PageHeader
        eyebrow="Administrator"
        title="Sessions"
        description="Manage all programme sessions across cohorts."
        action={
          <Button className="rounded-lg px-3" onClick={() => setCreateOpen(true)} disabled={loading}>
            <CalendarPlus className="size-4" /> Create Session
          </Button>
        }
      />

      {!loading && !loadError && (
        <SessionDialog
          open={createOpen}
          onOpenChange={handleCreateOpenChange}
          cohorts={cohorts}
          facilitators={facilitators}
          onSaved={handleSaved}
        />
      )}

      {loading && <PageLoading />}
      {!loading && loadError && <PageError>{loadError}</PageError>}

      {!loading && !loadError && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={CalendarDays} label="Total Sessions" value={counts.total} hint="All statuses" />
            <StatCard icon={Clock} label="Upcoming Sessions" value={counts.upcoming} hint="Scheduled" />
            <StatCard icon={CheckCircle2} label="Completed Sessions" value={counts.completed} hint="Delivered" />
            <StatCard
              icon={ClipboardCheck}
              label="Attendance Submitted"
              value={counts.attendance}
              hint="Sessions with records filed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search session title…" />
            <SegmentedFilter options={FILTERS} value={filter} onChange={setFilter} />
          </div>

          <DataTable
            head={[
              { label: 'Session Title' },
              { label: 'Cohort' },
              { label: 'Date' },
              { label: 'Time' },
              { label: 'Facilitator' },
              { label: 'Status' },
              { label: 'Action', align: 'right' },
            ]}
          >
            {visible.map((s) => (
              <Tr key={s.id}>
                <Td strong>{s.title}</Td>
                <Td muted>{cohorts.find((c) => c.id === s.cohort_id)?.name ?? '—'}</Td>
                <Td muted className="whitespace-nowrap">
                  {formatSessionDate(s.start_time)}
                </Td>
                <Td muted className="whitespace-nowrap">
                  {formatSessionTime(s.start_time, s.end_time)}
                </Td>
                <Td muted>{users.find((u) => u.id === s.facilitator_id)?.full_name ?? 'Unassigned'}</Td>
                <Td>
                  <Tag tone={sessionStatusTone[s.status]}>{sessionStatusLabel[s.status]}</Tag>
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-1">
                    <SessionDialog
                      session={s}
                      cohorts={cohorts}
                      facilitators={facilitators}
                      onSaved={handleSaved}
                      trigger={
                        <Button variant="ghost" size="icon" className="size-7">
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Edit {s.title}</span>
                        </Button>
                      }
                    />
                    <RowLink to={`/admin/sessions/${s.id}`}>View Session</RowLink>
                  </div>
                </Td>
              </Tr>
            ))}
            {visible.length === 0 && (
              <EmptyRow colSpan={7}>
                {sessions.length === 0 ? 'No sessions scheduled yet.' : 'No sessions match your search.'}
              </EmptyRow>
            )}
          </DataTable>
        </>
      )}
    </Page>
  )
}
