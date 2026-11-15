import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  FolderKanban,
  LineChart,
  Loader2,
  MessageSquareText,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { HeaderChip, Page, PageHeader } from '@/components/PageHeader'
import { EmptyState, Panel, PanelHeader, PanelItem, PanelLink, Pill } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import {
  getCohort,
  getIntakeForm,
  getProjectByStudentId,
  listAttendanceForStudents,
  listMentorComments,
  listProgressUpdatesByStudent,
  listSessions,
} from '@/data/queries'
import { formatDate, stageLabels, timeAgo } from '@/lib/format'
import type {
  AttendanceRecord,
  Cohort,
  IntakeForm,
  MentorComment,
  Project,
  ProgressUpdate,
  Session,
} from '@/types'

function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function StudentDashboard() {
  const { user } = useAuth()
  const [cohort, setCohort] = React.useState<Cohort | null>(null)
  const [project, setProject] = React.useState<Project | null>(null)
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [intake, setIntake] = React.useState<IntakeForm | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      user.cohort_id ? getCohort(user.cohort_id).catch(() => null) : Promise.resolve(null),
      getProjectByStudentId(user.id),
      listSessions(),
      listAttendanceForStudents([user.id]),
      listProgressUpdatesByStudent(user.id),
      listMentorComments({ studentId: user.id }),
      getIntakeForm(user.id),
    ])
      .then(([cohortData, projectData, sessionData, attendanceData, updateData, commentData, intakeData]) => {
        if (cancelled) return
        setCohort(cohortData)
        setProject(projectData)
        setSessions(sessionData.filter((s) => s.cohort_id === user.cohort_id && s.status !== 'cancelled'))
        setAttendance(attendanceData)
        setUpdates(updateData)
        setComments(commentData)
        setIntake(intakeData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard')
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
  const upcoming = sessions
    .filter((s) => new Date(s.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  const [nextSession, ...laterSessions] = upcoming

  const pastSessionIds = new Set(
    sessions.filter((s) => new Date(s.end_time).getTime() < now).map((s) => s.id),
  )
  const attendedCount = attendance.filter(
    (a) => pastSessionIds.has(a.session_id) && a.status === 'present',
  ).length
  const attendancePct =
    pastSessionIds.size > 0 ? `${Math.round((attendedCount / pastSessionIds.size) * 100)}%` : '—'

  const recentUpdates = updates.slice(0, 3)
  const recentComments = comments.slice(0, 3)
  const firstName = user.full_name.split(' ')[0] || user.full_name

  const steps = [
    { done: !!intake, label: 'Fill in your intake form', to: '/profile' },
    { done: !!project, label: 'Start your project', to: '/workspace' },
    { done: updates.length > 0, label: 'Post your first progress update', to: '/progress' },
  ]

  return (
    <Page>
      <PageHeader
        eyebrow={cohort?.name ?? 'Builder Venture'}
        title={`Welcome back, ${firstName}.`}
        description="Here's what's happening in your cohort today."
        action={cohort && <HeaderChip label="Cohort ends" value={formatDate(cohort.end_date)} />}
      />

      {steps.some((s) => !s.done) && (
        <Panel>
          <PanelHeader icon={Sparkles} title="Get started" description="A few things to set up your builder journey." />
          <div className="grid gap-2 sm:grid-cols-3">
            {steps.map((step) => (
              <Link
                key={step.to}
                to={step.to}
                className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm hover:bg-muted/60"
              >
                {step.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={step.done ? 'text-muted-foreground line-through' : ''}>{step.label}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Next session"
          value={nextSession ? formatSessionDate(nextSession.start_time) : 'None scheduled'}
          hint={nextSession?.title}
        />
        <StatCard
          icon={CheckCircle2}
          label="Attendance"
          value={attendancePct}
          hint={
            pastSessionIds.size > 0
              ? `${attendedCount} of ${pastSessionIds.size} past sessions`
              : 'No past sessions yet'
          }
        />
        <StatCard
          icon={FolderKanban}
          label="Project stage"
          value={project ? stageLabels[project.current_stage] : '—'}
          hint={project?.name ?? 'No project yet'}
        />
        <StatCard
          icon={LineChart}
          label="Progress updates"
          value={updates.length}
          hint={updates.length > 0 ? `Most recent ${recentUpdates.length} shown below` : 'None yet'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader icon={Sparkles} title="Next up" action={<PanelLink to="/sessions">View all sessions</PanelLink>} />
          {nextSession ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{nextSession.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  {formatSessionDate(nextSession.start_time)}
                </div>
                {nextSession.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{nextSession.description}</p>
                )}
                {nextSession.link && (
                  <a
                    href={nextSession.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Join session
                  </a>
                )}
              </div>

              {laterSessions.length > 0 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Then coming up
                  </div>
                  {laterSessions.slice(0, 2).map((s) => (
                    <div key={s.id} className="rounded-lg px-3 py-2 hover:bg-muted/60">
                      <div className="truncate text-sm font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{formatSessionDate(s.start_time)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState>No upcoming sessions scheduled yet.</EmptyState>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            icon={FolderKanban}
            title="Your project"
            action={<PanelLink to="/workspace">{project ? 'Open project' : 'Start project'}</PanelLink>}
          />
          {project ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Name</div>
                <div className="mt-1 font-medium">{project.name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Current stage</div>
                <Pill className="mt-1">{stageLabels[project.current_stage]}</Pill>
                <p className="mt-2 text-xs text-muted-foreground">Stage is updated by your mentor or admin.</p>
              </div>
            </div>
          ) : (
            <EmptyState>You haven't started a project yet.</EmptyState>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader
            icon={LineChart}
            title="Recent progress updates"
            action={<PanelLink to="/progress">Post update</PanelLink>}
          />
          {recentUpdates.length > 0 ? (
            <ul className="space-y-3">
              {recentUpdates.map((u) => (
                <PanelItem key={u.id}>
                  <div className="text-xs text-muted-foreground">{timeAgo(u.created_at)}</div>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed">
                    <span className="font-medium">Worked on: </span>
                    {u.summary}
                  </p>
                  {u.blockers && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      <span className="font-medium">Blockers: </span>
                      {u.blockers}
                    </p>
                  )}
                </PanelItem>
              ))}
            </ul>
          ) : (
            <EmptyState>No progress updates yet. Share what you're working on.</EmptyState>
          )}
        </Panel>

        <Panel>
          <PanelHeader icon={MessageSquareText} title="Mentor feedback" />
          {recentComments.length > 0 ? (
            <ul className="space-y-3">
              {recentComments.map((c) => (
                <PanelItem key={c.id}>
                  <div className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</div>
                  <p className="mt-1 line-clamp-4 text-sm leading-relaxed">{c.comment}</p>
                </PanelItem>
              ))}
            </ul>
          ) : (
            <EmptyState>No mentor feedback yet.</EmptyState>
          )}
        </Panel>
      </div>
    </Page>
  )
}
