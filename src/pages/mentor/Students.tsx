import * as React from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Page, PageHeader } from '@/components/PageHeader'
import { EmptyState, Pill } from '@/components/Panel'
import { ToneStatCard } from '@/components/ToneStatCard'
import { FilterBar } from '@/components/FilterBar'
import { PageError, PageLoading } from '@/components/PageStatus'
import { listProjects, listSessions } from '@/data/queries'
import {
  STALE_UPDATE_DAYS,
  errorMessage,
  lastUpdateLabel,
  listActiveStudents,
  listAllAttendance,
  listAllProgressUpdates,
  listMyAssignedStudentIds,
  studentHealth,
  studentStatusMeta,
  type StudentStatus,
} from '@/data/queries-mentor'
import { stageLabels } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AttendanceRecord, Project, ProgressUpdate, Session, User } from '@/types'

type FilterKey = 'all' | 'assigned' | StudentStatus | 'no-updates'

function attendanceTone(rate: number) {
  if (rate >= 85) return 'text-success'
  if (rate >= 70) return 'text-warning-foreground'
  return 'text-destructive'
}

export function MentorStudents() {
  const { user } = useAuth()
  const [students, setStudents] = React.useState<User[]>([])
  const [assignedIds, setAssignedIds] = React.useState<Set<string>>(new Set())
  const [projects, setProjects] = React.useState<Project[]>([])
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [filter, setFilter] = React.useState<FilterKey>('all')
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      listActiveStudents(),
      listMyAssignedStudentIds(user.id),
      listProjects(),
      listAllProgressUpdates(),
      listAllAttendance(),
      listSessions(),
    ])
      .then(([s, a, p, u, at, se]) => {
        if (cancelled) return
        setStudents(s)
        setAssignedIds(a)
        setProjects(p)
        setUpdates(u)
        setAttendance(at)
        setSessions(se)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load students'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const rows = React.useMemo(() => {
    const sessionsById = new Map(sessions.map((s) => [s.id, s]))
    return students.map((student) => ({
      student,
      project: projects.find((p) => p.student_id === student.id),
      assigned: assignedIds.has(student.id),
      health: studentHealth(
        updates.filter((u) => u.student_id === student.id),
        attendance.filter((r) => r.student_id === student.id),
        sessionsById,
      ),
    }))
  }, [students, projects, assignedIds, updates, attendance, sessions])

  const stats = {
    total: rows.length,
    onTrack: rows.filter((r) => r.health.status === 'on-track').length,
    needs: rows.filter((r) => r.health.status === 'needs-attention').length,
    atRisk: rows.filter((r) => r.health.status === 'at-risk').length,
  }

  const q = query.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (filter === 'assigned' && !r.assigned) return false
    if (
      filter === 'no-updates' &&
      r.health.daysSinceUpdate !== null &&
      r.health.daysSinceUpdate < STALE_UPDATE_DAYS
    )
      return false
    if (
      (filter === 'on-track' || filter === 'needs-attention' || filter === 'at-risk') &&
      r.health.status !== filter
    )
      return false
    if (q && !r.student.full_name.toLowerCase().includes(q)) return false
    return true
  })

  if (loading) return <PageLoading />
  if (loadError) return <PageError message={loadError} />

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All Students' },
    { key: 'assigned', label: `Assigned to Me (${assignedIds.size})` },
    { key: 'on-track', label: 'On Track' },
    { key: 'needs-attention', label: 'Needs Attention' },
    { key: 'at-risk', label: 'At Risk' },
    { key: 'no-updates', label: 'No Recent Updates' },
  ]

  return (
    <Page>
      <PageHeader
        eyebrow="Mentor"
        title="Students"
        description="Overview of every active student across the programme. Students assigned to you are marked."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ToneStatCard icon={Users} label="Total Students" value={stats.total} tone="primary" />
        <ToneStatCard icon={CheckCircle2} label="On Track" value={stats.onTrack} tone="success" />
        <ToneStatCard icon={AlertTriangle} label="Needs Attention" value={stats.needs} tone="warning" />
        <ToneStatCard icon={AlertOctagon} label="At Risk" value={stats.atRisk} tone="destructive" />
      </div>

      {students.length === 0 ? (
        <EmptyState>There are no active students in the programme yet.</EmptyState>
      ) : (
        <>
          <FilterBar
            filters={filters}
            value={filter}
            onChange={setFilter}
            query={query}
            onQueryChange={setQuery}
            placeholder="Search by student name…"
          />

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-left font-medium">Project</th>
                    <th className="px-4 py-3 text-left font-medium">Stage</th>
                    <th className="px-4 py-3 text-left font-medium">Attendance</th>
                    <th className="px-4 py-3 text-left font-medium">Last Update</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(({ student, project, assigned, health }) => {
                    const meta = studentStatusMeta[health.status]
                    return (
                      <tr key={student.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            {student.full_name}
                            {assigned && (
                              <Pill tone="accent" className="px-2 py-0.5 text-[10px]">
                                Assigned
                              </Pill>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{project?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {project ? stageLabels[project.current_stage] : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 font-medium',
                            health.attendance === null
                              ? 'text-muted-foreground'
                              : attendanceTone(health.attendance),
                          )}
                        >
                          {health.attendance === null ? '—' : `${health.attendance}%`}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {lastUpdateLabel(health.daysSinceUpdate)}
                        </td>
                        <td className="px-4 py-3">
                          <Pill tone={meta.tone} className="px-2 py-0.5 text-[10px]">
                            {meta.label}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/mentor/students/${student.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium whitespace-nowrap hover:bg-muted"
                          >
                            View Student
                            <ArrowRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No students match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Page>
  )
}
