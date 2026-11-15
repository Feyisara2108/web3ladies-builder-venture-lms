import * as React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ClipboardCheck, Clock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Page, PageHeader } from '@/components/PageHeader'
import { Pill } from '@/components/Panel'
import { ToneStatCard } from '@/components/ToneStatCard'
import { FilterBar } from '@/components/FilterBar'
import { PageError, PageLoading } from '@/components/PageStatus'
import { getUserNames, listMentorComments, listProjects } from '@/data/queries'
import {
  daysSince,
  errorMessage,
  groupFeedbackByUpdate,
  listActiveStudents,
  listAllProgressUpdates,
  listCohortNames,
  listMyAssignedStudentIds,
  reviewStatus,
  reviewStatusMeta,
  type ReviewStatus,
} from '@/data/queries-mentor'
import { formatDate, stageLabels } from '@/lib/format'
import type { MentorComment, Project, ProgressUpdate, User } from '@/types'

type FilterKey = 'all' | 'assigned' | ReviewStatus

function relativeDays(iso: string) {
  const d = daysSince(iso)
  if (d <= 0) return 'Today'
  if (d === 1) return '1 day ago'
  return `${d} days ago`
}

function Block({
  label,
  tone = 'default',
  children,
}: {
  label: string
  tone?: 'default' | 'warn'
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        className={
          'text-xs font-medium tracking-wide uppercase ' +
          (tone === 'warn' ? 'text-warning-foreground' : 'text-muted-foreground')
        }
      >
        {label}
      </div>
      <p className="mt-1 line-clamp-4 text-sm leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  )
}

export function MentorReviews() {
  const { user } = useAuth()
  const [students, setStudents] = React.useState<User[]>([])
  const [assignedIds, setAssignedIds] = React.useState<Set<string>>(new Set())
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [mentorNames, setMentorNames] = React.useState<Map<string, string>>(new Map())
  const [cohortNames, setCohortNames] = React.useState<Map<string, string>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [filter, setFilter] = React.useState<FilterKey>('all')
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      listActiveStudents(),
      listMyAssignedStudentIds(user.id),
      listAllProgressUpdates(),
      listMentorComments(),
      listProjects(),
      listCohortNames(),
    ])
      .then(async ([s, a, u, c, p, cn]) => {
        const names = await getUserNames([...new Set(c.map((x) => x.mentor_id))])
        if (cancelled) return
        const activeIds = new Set(s.map((x) => x.id))
        setStudents(s)
        setAssignedIds(a)
        setUpdates(u.filter((x) => activeIds.has(x.student_id)))
        setComments(c)
        setProjects(p)
        setCohortNames(cn)
        setMentorNames(new Map(names.map((n) => [n.id, n.full_name])))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load reviews'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const items = React.useMemo(() => {
    const feedback = groupFeedbackByUpdate(updates, comments)
    const studentsById = new Map(students.map((s) => [s.id, s]))
    const projectsById = new Map(projects.map((p) => [p.id, p]))
    return updates.map((u) => {
      const fb = feedback.get(u.id) ?? []
      return {
        update: u,
        student: studentsById.get(u.student_id),
        project: projectsById.get(u.project_id),
        feedback: fb,
        status: reviewStatus(u, fb),
        assigned: assignedIds.has(u.student_id),
      }
    })
  }, [updates, comments, students, projects, assignedIds])

  if (loading) return <PageLoading />
  if (loadError) return <PageError message={loadError} />

  const stats = {
    pending: items.filter((i) => i.status === 'pending').length,
    reviewedThisWeek: items.filter(
      (i) => i.status === 'reviewed' && i.feedback.some((c) => daysSince(c.created_at) < 7),
    ).length,
    overdue: items.filter((i) => i.status === 'overdue').length,
  }

  const q = query.trim().toLowerCase()
  const filtered = items.filter((i) => {
    if (filter === 'assigned' && !i.assigned) return false
    if (filter !== 'all' && filter !== 'assigned' && i.status !== filter) return false
    if (
      q &&
      !(i.student?.full_name.toLowerCase().includes(q) ?? false) &&
      !(i.project?.name.toLowerCase().includes(q) ?? false)
    )
      return false
    return true
  })

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'assigned', label: 'Assigned to Me' },
  ]
  const cohortName = user.cohort_id ? cohortNames.get(user.cohort_id) : undefined

  return (
    <Page>
      <PageHeader
        eyebrow={cohortName ? `Mentor · ${cohortName}` : 'Mentor'}
        title="Reviews"
        description="Review student progress updates and leave feedback."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToneStatCard icon={Clock} label="Pending Reviews" value={stats.pending} tone="warning" />
        <ToneStatCard
          icon={CheckCircle2}
          label="Reviewed This Week"
          value={stats.reviewedThisWeek}
          tone="success"
        />
        <ToneStatCard icon={AlertCircle} label="Overdue Reviews" value={stats.overdue} tone="destructive" />
      </div>

      <FilterBar
        filters={filters}
        value={filter}
        onChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        placeholder="Search by student or project…"
      />

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
            {items.length === 0
              ? 'No progress updates have been submitted yet.'
              : 'No reviews match the current filters.'}
          </div>
        ) : (
          filtered.map(({ update: u, student, project, feedback, status, assigned }) => {
            const meta = reviewStatusMeta[status]
            const reviewers = [...new Set(feedback.map((c) => mentorNames.get(c.mentor_id)).filter(Boolean))]
            return (
              <article
                key={u.id}
                className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{student?.full_name ?? 'Student'}</h3>
                      <Pill tone={meta.tone} className="px-2 py-0.5 text-[10px]">
                        {meta.label}
                      </Pill>
                      {assigned && (
                        <Pill tone="accent" className="px-2 py-0.5 text-[10px]">
                          Assigned to you
                        </Pill>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {project?.name ?? 'Project'}
                      {project && (
                        <>
                          {' · '}
                          <span className="text-foreground/70">{stageLabels[project.current_stage]}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs whitespace-nowrap text-muted-foreground">
                    Submitted {relativeDays(u.created_at)} · {formatDate(u.created_at)}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Block label="Worked On">{u.summary}</Block>
                  {u.learned && <Block label="Learned / Discovered">{u.learned}</Block>}
                  {u.blockers && (
                    <Block label="Blockers" tone="warn">
                      {u.blockers}
                    </Block>
                  )}
                  {u.next_steps && <Block label="Next Steps">{u.next_steps}</Block>}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Link
                    to={`/mentor/reviews/${u.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <ClipboardCheck className="size-3.5" />
                    {status === 'reviewed' ? 'View Review' : 'Review Submission'}
                  </Link>
                  {reviewers.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Feedback from {reviewers.join(', ')}
                    </span>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>
    </Page>
  )
}
