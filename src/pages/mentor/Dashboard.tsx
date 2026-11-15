import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderKanban,
  LineChart,
  Sparkles,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { HeaderChip, Page, PageHeader } from '@/components/PageHeader'
import { EmptyState, Panel, PanelHeader, PanelLink, Pill } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import { PageError, PageLoading } from '@/components/PageStatus'
import { listMentorComments, listProjects, listSessions, mentorCohortIds } from '@/data/queries'
import {
  attentionReasonMeta,
  errorMessage,
  groupFeedbackByUpdate,
  listActiveStudents,
  listAllAttendance,
  listAllProgressUpdates,
  listCohortNames,
  listMyAssignedStudentIds,
  reviewStatus,
  reviewStatusMeta,
  studentHealth,
} from '@/data/queries-mentor'
import { formatDateTime, stageLabels, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  AttendanceRecord,
  MentorComment,
  Project,
  ProgressUpdate,
  Session,
  User,
} from '@/types'

type ActivityKind = 'update' | 'project' | 'missed'

const activityIcon: Record<ActivityKind, LucideIcon> = {
  update: LineChart,
  project: FolderKanban,
  missed: AlertTriangle,
}

const activityTone: Record<ActivityKind, string> = {
  update: 'bg-primary/10 text-primary',
  project: 'bg-accent text-accent-foreground',
  missed: 'bg-destructive/10 text-destructive',
}

interface Activity {
  id: string
  kind: ActivityKind
  who: string
  text: string
  at: string
  to: string
  cta: string
  pill?: { label: string; tone: 'warning' | 'success' | 'destructive' }
}

const ACTIVITY_LIMIT = 8

export function MentorDashboard() {
  const { user } = useAuth()

  const [students, setStudents] = React.useState<User[]>([])
  const [assignedIds, setAssignedIds] = React.useState<Set<string>>(new Set())
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [cohortNames, setCohortNames] = React.useState<Map<string, string>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      listActiveStudents(),
      listMyAssignedStudentIds(user.id),
      listSessions(),
      listProjects(),
      listAllProgressUpdates(),
      listAllAttendance(),
      listMentorComments(),
      listCohortNames(),
    ])
      .then(([s, a, se, p, u, at, c, cn]) => {
        if (cancelled) return
        const activeIds = new Set(s.map((x) => x.id))
        setStudents(s)
        setAssignedIds(a)
        setSessions(se)
        setProjects(p)
        setUpdates(u.filter((x) => activeIds.has(x.student_id)))
        setAttendance(at.filter((x) => activeIds.has(x.student_id)))
        setComments(c)
        setCohortNames(cn)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load dashboard'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const derived = React.useMemo(() => {
    const sessionsById = new Map(sessions.map((s) => [s.id, s]))
    const studentsById = new Map(students.map((s) => [s.id, s]))
    const projectByStudent = new Map(projects.map((p) => [p.student_id, p]))
    const feedback = groupFeedbackByUpdate(updates, comments)

    const flagged = students
      .map((student) => ({
        student,
        project: projectByStudent.get(student.id),
        health: studentHealth(
          updates.filter((u) => u.student_id === student.id),
          attendance.filter((r) => r.student_id === student.id),
          sessionsById,
        ),
      }))
      .filter((x) => x.health.status !== 'on-track')
      .sort(
        (a, b) =>
          Number(assignedIds.has(b.student.id)) - Number(assignedIds.has(a.student.id)) ||
          Number(b.health.status === 'at-risk') - Number(a.health.status === 'at-risk'),
      )

    const pendingReviews = updates.filter((u) => reviewStatus(u, feedback.get(u.id)) !== 'reviewed')

    const cohortIds = mentorCohortIds(user, students)
    const nextSession = sessions
      .filter(
        (s) =>
          cohortIds.has(s.cohort_id) &&
          s.status !== 'cancelled' &&
          new Date(s.start_time).getTime() >= Date.now(),
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]

    const firstName = (id: string) => studentsById.get(id)?.full_name.split(' ')[0] ?? 'A student'
    const activity: Activity[] = []
    for (const u of updates) {
      const status = reviewStatus(u, feedback.get(u.id))
      const project = projectByStudent.get(u.student_id)
      activity.push({
        id: `u-${u.id}`,
        kind: 'update',
        who: firstName(u.student_id),
        text: `submitted a progress update${project ? ` on ${project.name}` : ''}`,
        at: u.created_at,
        to: `/mentor/reviews/${u.id}`,
        cta: status === 'reviewed' ? 'View review' : 'Review update',
        pill: status === 'reviewed' ? undefined : reviewStatusMeta[status],
      })
    }
    for (const p of projects) {
      if (!studentsById.has(p.student_id)) continue
      activity.push({
        id: `p-${p.id}`,
        kind: 'project',
        who: firstName(p.student_id),
        text: `updated their project ${p.name} · ${stageLabels[p.current_stage]}`,
        at: p.updated_at,
        to: `/mentor/students/${p.student_id}`,
        cta: 'View student',
      })
    }
    for (const r of attendance) {
      if (r.status !== 'absent') continue
      const session = sessionsById.get(r.session_id)
      activity.push({
        id: `a-${r.id}`,
        kind: 'missed',
        who: firstName(r.student_id),
        text: `missed ${session?.title ?? 'a session'}`,
        at: session?.start_time ?? r.marked_at,
        to: `/mentor/students/${r.student_id}`,
        cta: 'View student',
      })
    }
    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

    return {
      flagged,
      pendingReviews,
      nextSession,
      activity: activity.slice(0, ACTIVITY_LIMIT),
    }
  }, [students, assignedIds, sessions, projects, updates, attendance, comments, user])

  if (loading) return <PageLoading />
  if (loadError) return <PageError message={loadError} />

  const { flagged, pendingReviews, nextSession, activity } = derived
  const cohortName = user.cohort_id ? cohortNames.get(user.cohort_id) : undefined

  return (
    <Page>
      <PageHeader
        eyebrow={cohortName ? `Mentor · ${cohortName}` : 'Mentor'}
        title={`Welcome back, ${user.full_name.split(' ')[0]}.`}
        description="Here's where your students need you today."
        action={
          <HeaderChip
            label="Next session"
            value={nextSession ? formatDateTime(nextSession.start_time) : 'None scheduled'}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Assigned students"
          value={assignedIds.size}
          hint={`of ${students.length} active student${students.length === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Pending progress reviews"
          value={pendingReviews.length}
          hint="Updates awaiting feedback"
        />
        <StatCard
          icon={CalendarDays}
          label="Upcoming session"
          value={nextSession ? formatDateTime(nextSession.start_time) : '—'}
          hint={nextSession?.title ?? 'Nothing scheduled yet'}
        />
        <StatCard
          icon={AlertTriangle}
          label="Students needing attention"
          value={flagged.length}
          hint="See list below"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            icon={AlertTriangle}
            title="Students needing attention"
            action={<span className="text-xs text-muted-foreground">{flagged.length} flagged</span>}
          />
          {flagged.length === 0 ? (
            <EmptyState>Everyone's on track. Nice.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {flagged.map(({ student, project, health }) => (
                <li
                  key={student.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background/60 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{student.full_name}</div>
                      {health.reasons.map((r) => (
                        <Pill
                          key={r.reason}
                          tone={attentionReasonMeta[r.reason].tone}
                          className="px-2 py-0.5 text-[10px]"
                        >
                          {attentionReasonMeta[r.reason].label}
                        </Pill>
                      ))}
                      {assignedIds.has(student.id) && (
                        <Pill tone="accent" className="px-2 py-0.5 text-[10px]">
                          Assigned to you
                        </Pill>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {project ? (
                        <>
                          {project.name} ·{' '}
                          <span className="text-foreground/80">{stageLabels[project.current_stage]}</span>
                        </>
                      ) : (
                        'No project yet'
                      )}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {health.reasons.map((r) => r.detail).join(' · ')}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={`mailto:${student.email}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Reach out
                    </a>
                    <Link
                      to={`/mentor/students/${student.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Review
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            icon={Sparkles}
            title="Upcoming session"
            action={<PanelLink to="/mentor/sessions">View all</PanelLink>}
          />
          {nextSession ? (
            <div className="space-y-3">
              <h3 className="text-lg leading-tight font-semibold">{nextSession.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                {formatDateTime(nextSession.start_time)}
              </div>
              {nextSession.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">{nextSession.description}</p>
              )}
            </div>
          ) : (
            <EmptyState>No upcoming sessions for your cohorts.</EmptyState>
          )}
        </Panel>

        <Panel className="lg:col-span-3">
          <PanelHeader
            icon={LineChart}
            title="Recent activity"
            action={<PanelLink to="/mentor/reviews">Open review queue</PanelLink>}
          />
          {activity.length === 0 ? (
            <EmptyState>No student activity yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((a) => {
                const Icon = activityIcon[a.kind]
                return (
                  <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                        activityTone[a.kind],
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">
                        <span className="font-medium">{a.who}</span>{' '}
                        <span className="text-muted-foreground">{a.text}</span>
                        {a.pill && (
                          <Pill tone={a.pill.tone} className="ml-2 px-2 py-0.5 text-[10px]">
                            {a.pill.label}
                          </Pill>
                        )}
                      </p>
                      <div className="mt-0.5 text-xs text-muted-foreground">{timeAgo(a.at)}</div>
                    </div>
                    <Link
                      to={a.to}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      {a.cta}
                      <ArrowRight className="size-3" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </Page>
  )
}
