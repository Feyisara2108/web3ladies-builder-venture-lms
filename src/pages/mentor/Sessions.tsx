import * as React from 'react'
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MapPin,
  PlayCircle,
  Users,
  Video,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Page, PageHeader } from '@/components/PageHeader'
import { EmptyState, Pill } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import { PageError, PageLoading } from '@/components/PageStatus'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getUserNames, listSessions, mentorCohortIds, upsertAttendance } from '@/data/queries'
import {
  errorMessage,
  initials,
  listActiveStudents,
  listAllAttendance,
  listCohortNames,
} from '@/data/queries-mentor'
import { formatDate, formatDateTime, stageLabels } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AttendanceRecord, Session, User } from '@/types'

const statuses: AttendanceRecord['status'][] = ['present', 'absent', 'excused']

const locationLabels: Record<Session['location'], string> = {
  discord: 'Discord',
  zoom: 'Zoom',
  'in-person': 'In person',
  'google-meet': 'Google Meet',
}

const typeLabels: Record<Session['type'], string> = {
  'live-class': 'Live class',
  workshop: 'Workshop',
  'office-hours': 'Office hours',
  'demo-day': 'Demo day',
}

/** Stage (curriculum week stand-in) or format, shown where the reference shows "Week N". */
function sessionKicker(s: Session) {
  return s.stage ? `${stageLabels[s.stage]} · ${typeLabels[s.type]}` : typeLabels[s.type]
}

function isUpcoming(s: Session) {
  return s.status !== 'completed' && new Date(s.end_time).getTime() >= Date.now()
}

function rateTone(pct: number) {
  if (pct >= 85) return { cls: 'text-success', Icon: CheckCircle2 }
  if (pct >= 70) return { cls: 'text-warning-foreground', Icon: Clock }
  return { cls: 'text-destructive', Icon: XCircle }
}

const smallBtn =
  'inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap hover:bg-muted'

export function MentorSessions() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [sessionsList, setSessionsList] = React.useState<Session[]>([])
  const [students, setStudents] = React.useState<User[]>([])
  const [facilitatorNames, setFacilitatorNames] = React.useState<Map<string, string>>(new Map())
  const [cohortNames, setCohortNames] = React.useState<Map<string, string>>(new Map())
  const [attendanceRecords, setAttendanceRecords] = React.useState<AttendanceRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null)
  const [marks, setMarks] = React.useState<Record<string, AttendanceRecord['status']>>({})
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([listActiveStudents(), listSessions(), listAllAttendance(), listCohortNames()])
      .then(async ([studentData, sessionData, attendanceData, cn]) => {
        const cohortIds = mentorCohortIds(user, studentData)
        const cohortSessions = sessionData.filter((s) => cohortIds.has(s.cohort_id))
        const facilitatorIds = [
          ...new Set(cohortSessions.map((s) => s.facilitator_id).filter((id): id is string => !!id)),
        ]
        const names = await getUserNames(facilitatorIds)
        if (cancelled) return
        const activeIds = new Set(studentData.map((s) => s.id))
        setStudents(studentData)
        setSessionsList(cohortSessions)
        setFacilitatorNames(new Map(names.map((n) => [n.id, n.full_name])))
        setAttendanceRecords(attendanceData.filter((r) => activeIds.has(r.student_id)))
        setCohortNames(cn)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load sessions'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const studentsInSession = (sessionId: string | null) => {
    const session = sessionsList.find((s) => s.id === sessionId)
    return session ? students.filter((s) => s.cohort_id === session.cohort_id) : []
  }

  function sessionAttendance(session: Session) {
    const expected = new Set(studentsInSession(session.id).map((s) => s.id))
    const records = attendanceRecords.filter(
      (r) => r.session_id === session.id && expected.has(r.student_id),
    )
    const pct =
      records.length === 0
        ? null
        : Math.round((records.filter((r) => r.status === 'present').length / records.length) * 100)
    return { marked: records.length, expected: expected.size, pct }
  }

  function openAttendance(sessionId: string) {
    const existing = attendanceRecords.filter((r) => r.session_id === sessionId)
    const initial: Record<string, AttendanceRecord['status']> = {}
    for (const student of studentsInSession(sessionId)) {
      const record = existing.find((r) => r.student_id === student.id)
      initial[student.id] = record?.status ?? 'present'
    }
    setMarks(initial)
    setSaveError(null)
    setActiveSessionId(sessionId)
  }

  async function handleSaveAttendance() {
    if (!activeSessionId) return
    setSaving(true)
    setSaveError(null)
    try {
      await upsertAttendance(
        studentsInSession(activeSessionId).map((student) => ({
          session_id: activeSessionId,
          student_id: student.id,
          status: marks[student.id] ?? 'present',
          marked_by: user.id,
        })),
      )
      const activeIds = new Set(students.map((s) => s.id))
      const refreshed = await listAllAttendance()
      setAttendanceRecords(refreshed.filter((r) => activeIds.has(r.student_id)))
      setActiveSessionId(null)
      showToast('Attendance saved')
    } catch (err) {
      const message = errorMessage(err, 'Failed to save attendance')
      setSaveError(message)
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading />
  if (loadError) return <PageError message={loadError} />

  const upcoming = sessionsList
    .filter(isUpcoming)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  const previous = sessionsList
    .filter((s) => !isUpcoming(s))
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  const submittedCount = previous.filter((s) => sessionAttendance(s).marked > 0).length
  const nextUpcoming = upcoming[0]

  const selected = sessionsList.find((s) => s.id === selectedId) ?? null
  const activeSession = sessionsList.find((s) => s.id === activeSessionId)
  const cohortName = user.cohort_id ? cohortNames.get(user.cohort_id) : undefined
  const facilitator = (s: Session) =>
    (s.facilitator_id && facilitatorNames.get(s.facilitator_id)) || 'Unassigned'

  return (
    <Page>
      <PageHeader
        eyebrow={cohortName ? `Mentor · ${cohortName}` : 'Mentor'}
        title="Sessions"
        description="Manage cohort sessions, attendance, and resources."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Total Sessions"
          value={sessionsList.length}
          hint="Across your students’ cohorts"
        />
        <StatCard
          icon={Clock}
          label="Upcoming Sessions"
          value={upcoming.length}
          hint={nextUpcoming ? `Next: ${formatDate(nextUpcoming.start_time)}` : 'None scheduled'}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed Sessions"
          value={previous.length}
          hint="Already held"
        />
        <StatCard
          icon={Users}
          label="Attendance Submitted"
          value={`${submittedCount}/${previous.length}`}
          hint="Roll calls completed"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight">Upcoming Sessions</h2>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState>No upcoming sessions for your students’ cohorts.</EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {upcoming.map((s) => {
                  const cancelled = s.status === 'cancelled'
                  return (
                    <div
                      key={s.id}
                      className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium tracking-wide text-primary uppercase">
                          {sessionKicker(s)}
                        </span>
                        <Pill
                          tone={cancelled ? 'destructive' : s.status === 'active' ? 'success' : 'accent'}
                          className="px-2 py-0.5 text-[10px]"
                        >
                          {cancelled ? 'Cancelled' : s.status === 'active' ? 'Live now' : 'Upcoming'}
                        </Pill>
                      </div>
                      <h3 className="leading-tight font-semibold">{s.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {formatDateTime(s.start_time)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        Facilitator: {facilitator(s)}
                      </div>
                      {s.link ? (
                        <div className="flex items-center gap-2 text-xs text-primary">
                          <Video className="size-3.5" />
                          <a
                            href={s.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            Join on {locationLabels[s.location]}
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="size-3.5" />
                          {locationLabels[s.location]}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          <Eye className="size-3.5" />
                          View Session
                        </button>
                        {!cancelled && (
                          <button
                            type="button"
                            onClick={() => openAttendance(s.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            <Users className="size-3.5" />
                            Mark Attendance
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight">Previous Sessions</h2>
            </div>
            {previous.length === 0 ? (
              <EmptyState>No sessions have been held yet.</EmptyState>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Session</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Attendance</th>
                        <th className="px-4 py-3 text-left font-medium">Recording</th>
                        <th className="px-4 py-3 text-left font-medium">Notes</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previous.map((s) => {
                        const att = sessionAttendance(s)
                        const tone = att.pct === null ? null : rateTone(att.pct)
                        return (
                          <tr key={s.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 align-top">
                              <div className="font-medium">{s.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {sessionKicker(s)}
                                {s.status === 'cancelled' && ' · Cancelled'}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top whitespace-nowrap text-muted-foreground">
                              {formatDate(s.start_time)}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {tone && att.pct !== null ? (
                                <div className="flex items-center gap-1.5">
                                  <tone.Icon className={cn('size-3.5', tone.cls)} />
                                  <span className={cn('font-medium', tone.cls)}>{att.pct}%</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({att.marked}/{att.expected})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not submitted</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {s.recording_url ? (
                                <Pill tone="success" className="gap-1 px-2 py-0.5 text-[10px]">
                                  <PlayCircle className="size-3" /> Available
                                </Pill>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {s.resources_url ? (
                                <Pill tone="accent" className="gap-1 px-2 py-0.5 text-[10px]">
                                  <FileText className="size-3" /> Available
                                </Pill>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right align-top">
                              <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                {s.recording_url && (
                                  <a href={s.recording_url} target="_blank" rel="noreferrer" className={smallBtn}>
                                    <PlayCircle className="size-3" /> View Recording
                                  </a>
                                )}
                                {s.resources_url && (
                                  <a href={s.resources_url} target="_blank" rel="noreferrer" className={smallBtn}>
                                    <FileText className="size-3" /> View Notes
                                  </a>
                                )}
                                {s.status !== 'cancelled' && (
                                  <button type="button" onClick={() => openAttendance(s.id)} className={smallBtn}>
                                    <Users className="size-3" /> Attendance
                                  </button>
                                )}
                                <button type="button" onClick={() => setSelectedId(s.id)} className={smallBtn}>
                                  <Eye className="size-3" /> View
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {selected ? (
            <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold tracking-tight">Session Details</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>

              <div>
                <span className="text-xs font-medium tracking-wide text-primary uppercase">
                  {sessionKicker(selected)}
                </span>
                <h3 className="mt-1 leading-tight font-semibold">{selected.title}</h3>
                {selected.description && (
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                    {selected.description}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-4" />
                  <span>{formatDateTime(selected.start_time)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="size-4" />
                  <span>Facilitator: {facilitator(selected)}</span>
                </div>
                {cohortNames.get(selected.cohort_id) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BookOpen className="size-4" />
                    <span>{cohortNames.get(selected.cohort_id)}</span>
                  </div>
                )}
                {isUpcoming(selected) && selected.link ? (
                  <div className="flex items-center gap-2 text-primary">
                    <Video className="size-4" />
                    <a
                      href={selected.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      Join on {locationLabels[selected.location]}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4" />
                    <span>{locationLabels[selected.location]}</span>
                  </div>
                )}
              </div>

              {selected.learning_objectives && (
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Learning Objectives
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {selected.learning_objectives
                      .split('\n')
                      .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
                      .filter(Boolean)
                      .map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{obj}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {(selected.resources_url || selected.recording_url) && (
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Resources
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {selected.resources_url && (
                      <li>
                        <a
                          href={selected.resources_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Session notes & resources
                          <ExternalLink className="size-3" />
                        </a>
                      </li>
                    )}
                    {selected.recording_url && (
                      <li>
                        <a
                          href={selected.recording_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Recording
                          <ExternalLink className="size-3" />
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {selected.status !== 'cancelled' && (
                <Button size="sm" className="w-full" onClick={() => openAttendance(selected.id)}>
                  <Users className="size-3.5" />
                  Mark Attendance
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight">Session Details</h2>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Select a session from the upcoming or previous list to view its full details,
                learning objectives, and resources.
              </p>
            </div>
          )}
        </aside>
      </div>

      <Dialog open={!!activeSessionId} onOpenChange={(open) => !open && setActiveSessionId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeSession?.title}</DialogTitle>
            <DialogDescription>Mark each student's attendance for this session.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {studentsInSession(activeSessionId).length === 0 && (
              <p className="text-sm text-muted-foreground">No active students in this session's cohort.</p>
            )}
            {studentsInSession(activeSessionId).map((student) => (
              <div
                key={student.id}
                className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">{initials(student.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{student.full_name}</span>
                </div>
                <div className="flex gap-1">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setMarks((m) => ({ ...m, [student.id]: status }))}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs font-medium capitalize transition-colors',
                        marks[student.id] === status
                          ? status === 'present'
                            ? 'border-success bg-success/15 text-success'
                            : status === 'excused'
                              ? 'border-foreground bg-accent'
                              : 'border-destructive bg-destructive/15 text-destructive'
                          : 'border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <DialogFooter>
            <Button
              onClick={handleSaveAttendance}
              disabled={saving || studentsInSession(activeSessionId).length === 0}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
