import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderKanban,
  LineChart,
  MessageSquareText,
  Plus,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Page, PageHeader } from '@/components/PageHeader'
import { EmptyState, Panel, PanelHeader } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import { DataTable, EmptyRow, RowLink, Td, Tr } from '@/components/DataTable'
import { PageError, PageLoading } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  listCohorts,
  listMentorAssignments,
  listMentorComments,
  listProjects,
  listSessions,
  listUsers,
} from '@/data/queries'
import { listAllAttendance, listAllProgressUpdates, listRecentCreations, type CreatedRow } from '@/data/queries-admin'
import { getErrorMessage } from '@/lib/utils'
import type {
  AttendanceRecord,
  Cohort,
  MentorAssignment,
  MentorComment,
  Project,
  ProgressUpdate,
  Session,
  User,
} from '@/types'
import { attendanceRate, DAY_MS, formatRate, relativeTime } from './helpers'

const QUICK_ACTIONS: { id: string; label: string; icon: LucideIcon; to: string }[] = [
  { id: 'create-cohort', label: 'Create Cohort', icon: Plus, to: '/admin/cohorts?new=1' },
  { id: 'invite-student', label: 'Invite Student', icon: UserPlus, to: '/admin/users?invite=student' },
  { id: 'invite-mentor', label: 'Invite Mentor', icon: UserRound, to: '/admin/users?invite=mentor' },
  { id: 'schedule-session', label: 'Schedule Session', icon: CalendarDays, to: '/admin/sessions?new=1' },
]

type ActivityKind = 'onboard' | 'mentor' | 'session' | 'update' | 'cohort'

interface Activity {
  id: string
  kind: ActivityKind
  what: string
  who?: string
  target: string
  at: string
  to?: string
}

const activityIcon: Record<ActivityKind, LucideIcon> = {
  onboard: UserPlus,
  mentor: UserRound,
  session: CalendarDays,
  update: LineChart,
  cohort: FolderKanban,
}

const activityTone: Record<ActivityKind, string> = {
  onboard: 'text-primary bg-primary/10',
  mentor: 'text-blue-600 bg-blue-500/10 dark:text-blue-300',
  session: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-300',
  update: 'text-amber-600 bg-amber-500/10 dark:text-amber-300',
  cohort: 'text-purple-600 bg-purple-500/10 dark:text-purple-300',
}

type HealthTone = 'success' | 'warning' | 'danger'

function rateTone(rate: number | null, good: number): HealthTone {
  if (rate === null) return 'warning'
  return rate >= good ? 'success' : 'warning'
}

interface Data {
  users: User[]
  cohorts: Cohort[]
  sessions: Session[]
  projects: Project[]
  attendance: AttendanceRecord[]
  updates: ProgressUpdate[]
  comments: MentorComment[]
  assignments: MentorAssignment[]
  created: { cohorts: CreatedRow[]; sessions: CreatedRow[] }
}

export function AdminDashboard() {
  const [data, setData] = React.useState<Data | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      listUsers(),
      listCohorts(),
      listSessions(),
      listProjects(),
      listAllAttendance(),
      listAllProgressUpdates(),
      listMentorComments(),
      listMentorAssignments(),
      listRecentCreations(10),
    ])
      .then(([users, cohorts, sessions, projects, attendance, updates, comments, assignments, created]) => {
        if (!cancelled) {
          setData({ users, cohorts, sessions, projects, attendance, updates, comments, assignments, created })
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load overview'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const header = (
    <PageHeader
      eyebrow="Administrator"
      title="Admin Dashboard"
      description="High-level overview of the entire programme."
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-lg px-3">
              <Plus className="size-4" /> New Action
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {QUICK_ACTIONS.map((a) => (
              <DropdownMenuItem key={a.id} asChild>
                <Link to={a.to}>
                  <a.icon className="size-4" /> {a.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  )

  if (loading) {
    return (
      <Page>
        {header}
        <PageLoading />
      </Page>
    )
  }

  if (loadError || !data) {
    return (
      <Page>
        {header}
        <PageError>{loadError ?? 'Failed to load overview'}</PageError>
      </Page>
    )
  }

  const { users, cohorts, sessions, projects, attendance, updates, comments, assignments, created } = data
  const now = Date.now()
  const nameOf = (id: string) => users.find((u) => u.id === id)?.full_name ?? 'Someone'
  const cohortName = (id?: string | null) => cohorts.find((c) => c.id === id)?.name ?? 'No cohort'

  const students = users.filter((u) => u.role === 'student')
  const activeStudents = students.filter((u) => u.is_active)
  const mentors = users.filter((u) => u.role === 'mentor')
  const activeCohorts = cohorts.filter((c) => c.status === 'active')
  const upcomingSessions = sessions.filter((s) => {
    const t = new Date(s.start_time).getTime()
    return s.status === 'scheduled' && t >= now && t <= now + 14 * DAY_MS
  })

  // Pending reviews: projects whose newest progress update has no mentor comment after it.
  const latestUpdate = new Map<string, string>()
  for (const u of updates) {
    const prev = latestUpdate.get(u.project_id)
    if (!prev || u.created_at > prev) latestUpdate.set(u.project_id, u.created_at)
  }
  const latestComment = new Map<string, string>()
  for (const c of comments) {
    const prev = latestComment.get(c.project_id)
    if (!prev || c.created_at > prev) latestComment.set(c.project_id, c.created_at)
  }
  const pendingReviews = [...latestUpdate.entries()].filter(([projectId, at]) => {
    const reviewed = latestComment.get(projectId)
    return !reviewed || reviewed < at
  }).length
  const reviewedRate =
    latestUpdate.size === 0 ? null : Math.round(((latestUpdate.size - pendingReviews) / latestUpdate.size) * 100)

  // Weekly submissions / students needing attention.
  const lastUpdateByStudent = new Map<string, string>()
  for (const u of updates) {
    const prev = lastUpdateByStudent.get(u.student_id)
    if (!prev || u.created_at > prev) lastUpdateByStudent.set(u.student_id, u.created_at)
  }
  const submittedThisWeek = activeStudents.filter((s) => {
    const at = lastUpdateByStudent.get(s.id)
    return at && now - new Date(at).getTime() <= 7 * DAY_MS
  }).length
  const submissionRate =
    activeStudents.length === 0 ? null : Math.round((submittedThisWeek / activeStudents.length) * 100)
  const needingAttention = activeStudents.filter((s) => {
    if (!s.cohort_id) return false
    if (cohorts.find((c) => c.id === s.cohort_id)?.status !== 'active') return false
    const at = lastUpdateByStudent.get(s.id)
    return !at || now - new Date(at).getTime() > 14 * DAY_MS
  })
  const attentionCohorts = new Set(needingAttention.map((s) => s.cohort_id)).size
  const overallAttendance = attendanceRate(attendance)

  const health: { id: string; label: string; value: string; hint: string; tone: HealthTone }[] = [
    {
      id: 'attendance',
      label: 'Attendance Rate',
      value: formatRate(overallAttendance),
      hint: `${attendance.length} attendance records`,
      tone: rateTone(overallAttendance, 85),
    },
    {
      id: 'submissions',
      label: 'Weekly Submission Rate',
      value: formatRate(submissionRate),
      hint: `${submittedThisWeek} of ${activeStudents.length} students this week`,
      tone: rateTone(submissionRate, 80),
    },
    {
      id: 'reviews',
      label: 'Mentor Review Completion',
      value: formatRate(reviewedRate),
      hint: `${pendingReviews} review${pendingReviews === 1 ? '' : 's'} pending`,
      tone: rateTone(reviewedRate, 80),
    },
    {
      id: 'attention',
      label: 'Students Needing Attention',
      value: String(needingAttention.length),
      hint: `No update in 14 days · across ${attentionCohorts} cohort${attentionCohorts === 1 ? '' : 's'}`,
      tone: needingAttention.length > 0 ? 'danger' : 'success',
    },
  ]

  // Recent activity, built from real timestamps.
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'their project'
  const activity: Activity[] = [
    ...users
      .filter((u) => u.role !== 'admin' && u.invite_accepted_at)
      .map<Activity>((u) => ({
        id: `onboard-${u.id}`,
        kind: 'onboard',
        what: u.role === 'mentor' ? 'Mentor onboarded' : 'Student onboarded',
        who: u.full_name,
        target: cohortName(u.cohort_id),
        at: u.invite_accepted_at!,
        to: `/admin/users/${u.id}`,
      })),
    ...assignments.map<Activity>((a) => ({
      id: `assign-${a.id}`,
      kind: 'mentor',
      what: 'Mentor assigned',
      who: nameOf(a.mentor_id),
      target: nameOf(a.student_id),
      at: a.created_at,
      to: `/admin/users/${a.mentor_id}`,
    })),
    ...created.sessions.map<Activity>((s) => ({
      id: `session-${s.id}`,
      kind: 'session',
      what: 'Session scheduled',
      target: `${s.label} · ${cohortName(s.cohort_id)}`,
      at: s.created_at,
      to: `/admin/sessions/${s.id}`,
    })),
    ...updates.slice(0, 15).map<Activity>((u) => ({
      id: `update-${u.id}`,
      kind: 'update',
      what: 'Progress submitted',
      who: nameOf(u.student_id),
      target: projectName(u.project_id),
      at: u.created_at,
      to: `/admin/projects/${u.project_id}`,
    })),
    ...created.cohorts.map<Activity>((c) => ({
      id: `cohort-${c.id}`,
      kind: 'cohort',
      what: 'Cohort created',
      target: c.label,
      at: c.created_at,
      to: `/admin/cohorts/${c.id}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 7)

  // Cohort overview table.
  const cohortRows = [...cohorts]
    .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1))
    .map((c) => {
      const studentIds = new Set(students.filter((s) => s.cohort_id === c.id).map((s) => s.id))
      return {
        cohort: c,
        attendance: attendanceRate(attendance, (r) => studentIds.has(r.student_id)),
        updates: updates.filter((u) => studentIds.has(u.student_id)).length,
      }
    })

  return (
    <Page>
      {header}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Total Students" value={students.length} hint="Across all cohorts" />
        <StatCard
          icon={UserRound}
          label="Total Mentors"
          value={mentors.length}
          hint={`${mentors.filter((m) => m.is_active).length} active mentors`}
        />
        <StatCard icon={FolderKanban} label="Active Cohorts" value={activeCohorts.length} hint="Running now" />
        <StatCard icon={CalendarDays} label="Upcoming Sessions" value={upcomingSessions.length} hint="Next 14 days" />
        <StatCard icon={BarChart3} label="Active Projects" value={projects.length} hint="Student projects" />
        <StatCard
          icon={MessageSquareText}
          label="Pending Reviews"
          value={pendingReviews}
          hint="Awaiting mentor feedback"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            icon={FolderKanban}
            title="Cohort overview"
            action={<span className="text-xs text-muted-foreground">{cohorts.length} cohorts</span>}
          />
          <DataTable
            framed={false}
            head={[
              { label: 'Cohort' },
              { label: 'Students' },
              { label: 'Mentors' },
              { label: 'Attendance' },
              { label: 'Updates' },
              { label: 'Action', align: 'right' },
            ]}
          >
            {cohortRows.map(({ cohort, attendance: rate, updates: count }) => (
              <Tr key={cohort.id}>
                <Td strong>{cohort.name}</Td>
                <Td muted>{cohort.student_count}</Td>
                <Td muted>{cohort.mentor_count}</Td>
                <Td>
                  <span
                    className={
                      rate === null
                        ? 'text-muted-foreground'
                        : rate >= 85
                          ? 'font-medium text-emerald-600'
                          : 'font-medium text-amber-600'
                    }
                  >
                    {formatRate(rate)}
                  </span>
                </Td>
                <Td>
                  <span className="font-medium">{count}</span>
                </Td>
                <Td align="right">
                  <RowLink to={`/admin/cohorts/${cohort.id}`}>View Cohort</RowLink>
                </Td>
              </Tr>
            ))}
            {cohorts.length === 0 && <EmptyRow colSpan={6}>No cohorts yet.</EmptyRow>}
          </DataTable>
        </Panel>

        <Panel>
          <PanelHeader icon={Plus} title="Quick actions" />
          <div className="grid grid-cols-1 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.id}
                to={action.to}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <action.icon className="size-4" />
                </div>
                {action.label}
              </Link>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader icon={Clock} title="Recent activity" />
          {activity.length === 0 ? (
            <EmptyState>No activity yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((a) => {
                const Icon = activityIcon[a.kind]
                const body = (
                  <>
                    <span className="font-medium">{a.what}</span>{' '}
                    <span className="text-muted-foreground">
                      {a.who && <>by {a.who} </>}— {a.target}
                    </span>
                  </>
                )
                return (
                  <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${activityTone[a.kind]}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">
                        {a.to ? (
                          <Link to={a.to} className="hover:underline">
                            {body}
                          </Link>
                        ) : (
                          body
                        )}
                      </p>
                      <div className="mt-0.5 text-xs text-muted-foreground">{relativeTime(a.at)}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader icon={BarChart3} title="Programme health" />
          <div className="grid grid-cols-1 gap-3">
            {health.map((kpi) => (
              <div
                key={kpi.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{kpi.label}</div>
                  <div className="mt-1 text-xl font-semibold">{kpi.value}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{kpi.hint}</div>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/80">
                  {kpi.tone === 'success' && <CheckCircle2 className="size-5 text-emerald-600" />}
                  {kpi.tone === 'warning' && <Clock className="size-5 text-amber-600" />}
                  {kpi.tone === 'danger' && <Bell className="size-5 text-red-600" />}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Page>
  )
}
