import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MinusCircle,
  PlayCircle,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { HeaderChip, Page, PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/Panel'
import { listAttendanceForStudents, listSessions } from '@/data/queries'
import type { AttendanceRecord, Session } from '@/types'

function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function AttendanceBadge({ status }: { status?: AttendanceRecord['status'] }) {
  if (status === 'present')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        <CheckCircle2 className="size-3" /> Attended
      </span>
    )
  if (status === 'absent')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="size-3" /> Missed
      </span>
    )
  if (status === 'excused')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
        <MinusCircle className="size-3" /> Excused
      </span>
    )
  return <span className="text-xs text-muted-foreground">Not marked</span>
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function ResourceLinks({ session }: { session: Session }) {
  if (!session.recording_url && !session.resources_url) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="inline-flex items-center gap-3 text-xs">
      {session.recording_url && (
        <a
          className="inline-flex items-center gap-1 text-primary hover:underline"
          href={session.recording_url}
          target="_blank"
          rel="noreferrer"
        >
          <PlayCircle className="size-3.5" /> Recording
        </a>
      )}
      {session.resources_url && (
        <a
          className="inline-flex items-center gap-1 text-primary hover:underline"
          href={session.resources_url}
          target="_blank"
          rel="noreferrer"
        >
          <FileText className="size-3.5" /> Notes
        </a>
      )}
    </div>
  )
}

export function StudentSessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([listSessions(), listAttendanceForStudents([user.id])])
      .then(([sessionData, attendanceData]) => {
        if (cancelled) return
        setSessions(
          sessionData
            .filter((s) => s.cohort_id === user.cohort_id && s.status !== 'cancelled')
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
        )
        setAttendance(attendanceData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load sessions')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id, user.cohort_id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <Page>
        <p className="text-sm text-destructive">{loadError}</p>
      </Page>
    )
  }

  const now = Date.now()
  // Sessions are numbered by their order in the cohort: Week 1, Week 2…
  const weekOf = new Map(sessions.map((s, i) => [s.id, i + 1]))
  const statusBySession = new Map(attendance.map((a) => [a.session_id, a.status]))
  const upcoming = sessions.filter((s) => new Date(s.end_time).getTime() >= now)
  const past = sessions.filter((s) => new Date(s.end_time).getTime() < now).reverse()
  const attended = past.filter((s) => statusBySession.get(s.id) === 'present').length
  const attendancePct = past.length ? Math.round((attended / past.length) * 100) : 0

  return (
    <Page>
      <PageHeader
        eyebrow="Cohort sessions"
        title="Sessions"
        description="Live calls, recordings, and your attendance record."
        action={
          <HeaderChip
            label="Attendance"
            value={
              past.length ? (
                <>
                  {attendancePct}% &middot; {attended}/{past.length} past sessions
                </>
              ) : (
                'No past sessions yet'
              )
            }
          />
        }
      />

      {!user.cohort_id && (
        <EmptyState>You're not in a cohort yet. Sessions will appear once an admin adds you to one.</EmptyState>
      )}

      <Section icon={CalendarDays} title="Upcoming">
        {upcoming.length === 0 ? (
          <EmptyState>No upcoming sessions scheduled.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {upcoming.map((s) => {
              const live = new Date(s.start_time).getTime() <= now
              return (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-primary">
                      Week {weekOf.get(s.id)}
                    </span>
                    <span className={live ? 'text-xs font-medium text-success' : 'text-xs text-muted-foreground'}>
                      {live ? 'Live now' : 'Upcoming'}
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold">{s.title}</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {formatSessionDate(s.start_time)}
                  </div>
                  {s.description && (
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{s.description}</p>
                  )}
                  {(s.link || s.resources_url) && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {s.link && (
                        <a
                          href={s.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Join session <ExternalLink className="size-3" />
                        </a>
                      )}
                      {s.resources_url && (
                        <a
                          href={s.resources_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="size-3.5" /> Notes
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section icon={PlayCircle} title="Past sessions">
        {past.length === 0 ? (
          <EmptyState>No past sessions yet. Recordings and notes will appear here.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Week</th>
                  <th className="px-4 py-3 text-left font-medium">Session</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Attendance</th>
                  <th className="px-4 py-3 text-right font-medium">Resources</th>
                </tr>
              </thead>
              <tbody>
                {past.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 align-top font-medium">W{weekOf.get(s.id)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{s.title}</div>
                      {(s.learning_objectives || s.description) && (
                        <div className="mt-1 line-clamp-2 max-w-md text-xs text-muted-foreground">
                          {s.learning_objectives || s.description}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                      {new Date(s.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <AttendanceBadge status={statusBySession.get(s.id)} />
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <ResourceLinks session={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Page>
  )
}
