import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Save,
  User as UserIcon,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Page } from '@/components/PageHeader'
import { EmptyState, Pill } from '@/components/Panel'
import { FieldBlock, IconSection, InfoRow } from '@/components/IconSection'
import { StageForwardSelect } from '@/components/StageForwardSelect'
import { PageLoading } from '@/components/PageStatus'
import { FeedbackNote } from '@/components/FeedbackNote'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  createMentorComment,
  getProjectByStudentId,
  getUser,
  getUserNames,
  listAttendanceForStudents,
  listMentorComments,
  listProgressUpdatesByStudent,
  listSessions,
} from '@/data/queries'
import {
  errorMessage,
  groupFeedbackByUpdate,
  listCohortNames,
  reviewStatus,
  reviewStatusMeta,
} from '@/data/queries-mentor'
import { formatDate, formatDateTime, stageLabels } from '@/lib/format'
import type {
  AttendanceRecord,
  MentorComment,
  Project,
  ProgressUpdate,
  Session,
  User,
} from '@/types'

function BackLink() {
  return (
    <Link
      to="/mentor/students"
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to Students
    </Link>
  )
}

function ExternalRow({ label, href }: { label: string; href?: string }) {
  if (!href) return null
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        {label}
        <ExternalLink className="size-3" />
      </a>
    </li>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">
        {value?.trim() ? value : <span className="text-muted-foreground">Not provided yet.</span>}
      </p>
    </div>
  )
}

export function MentorStudentReview() {
  const { studentId } = useParams<{ studentId: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [student, setStudent] = React.useState<User | null>(null)
  const [project, setProject] = React.useState<Project | null>(null)
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [cohortNames, setCohortNames] = React.useState<Map<string, string>>(new Map())
  const [mentorNames, setMentorNames] = React.useState<Map<string, string>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!studentId) {
      setLoading(false)
      return
    }
    let cancelled = false
    Promise.all([
      getUser(studentId),
      getProjectByStudentId(studentId),
      listProgressUpdatesByStudent(studentId),
      listMentorComments({ studentId }),
      listAttendanceForStudents([studentId]),
      listSessions(),
      listCohortNames(),
    ])
      .then(async ([s, p, u, c, a, se, cn]) => {
        const names = await getUserNames([...new Set(c.map((x) => x.mentor_id))])
        if (cancelled) return
        setStudent(s)
        setProject(p)
        setUpdates(u)
        setComments(c)
        setAttendance(a)
        setSessions(se)
        setCohortNames(cn)
        setMentorNames(new Map(names.map((n) => [n.id, n.full_name])))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load student'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  const latestUpdate = updates[0]

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault()
    if (!feedback.trim() || !project || !student) return
    setSubmitting(true)
    setFeedbackError(null)
    try {
      const created = await createMentorComment({
        project_id: project.id,
        mentor_id: user.id,
        student_id: student.id,
        comment: feedback.trim(),
        progress_update_id: latestUpdate?.id,
      })
      setComments((prev) => [created, ...prev])
      setMentorNames((prev) => new Map(prev).set(user.id, user.full_name))
      setFeedback('')
      showToast('Feedback submitted')
    } catch (err) {
      const message = errorMessage(err, 'Failed to submit feedback')
      setFeedbackError(message)
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoading />

  if (loadError || !student) {
    return (
      <Page>
        <BackLink />
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            {loadError ? 'Failed to load student' : 'Student not found'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {loadError ?? 'The student you are looking for does not exist.'}
          </p>
          <Button asChild size="sm" className="mt-6">
            <Link to="/mentor/students">
              <ArrowLeft className="size-3.5" /> Return to Students
            </Link>
          </Button>
        </div>
      </Page>
    )
  }

  const firstName = student.full_name.split(' ')[0]
  const cohortName = student.cohort_id ? cohortNames.get(student.cohort_id) : undefined
  const sessionsById = new Map(sessions.map((s) => [s.id, s]))
  const feedbackByUpdate = groupFeedbackByUpdate(updates, comments)
  const earlierFeedback = feedbackByUpdate.get(null) ?? []

  const sortedAttendance = [...attendance].sort(
    (a, b) =>
      new Date(sessionsById.get(b.session_id)?.start_time ?? b.marked_at).getTime() -
      new Date(sessionsById.get(a.session_id)?.start_time ?? a.marked_at).getTime(),
  )
  const attendanceRate =
    attendance.length === 0
      ? null
      : Math.round((attendance.filter((r) => r.status === 'present').length / attendance.length) * 100)
  const lastRecord = sortedAttendance[0]
  const lastSession = lastRecord ? sessionsById.get(lastRecord.session_id) : undefined

  return (
    <Page>
      <div>
        <BackLink />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-muted-foreground uppercase">Student Review</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{student.full_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[project?.name ?? 'No project yet', cohortName].filter(Boolean).join(' · ')}
            </p>
          </div>
          {project && (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Current stage: {stageLabels[project.current_stage]}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <IconSection title="Student Information" icon={UserIcon}>
          <InfoRow icon={UserIcon} label="Full name">
            {student.full_name}
          </InfoRow>
          <InfoRow icon={Mail} label="Email">
            <a href={`mailto:${student.email}`} className="text-primary hover:underline">
              {student.email}
            </a>
          </InfoRow>
          {student.whatsapp_number && (
            <InfoRow icon={MessageSquare} label="WhatsApp">
              <a
                href={`https://wa.me/${student.whatsapp_number.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {student.whatsapp_number}
              </a>
            </InfoRow>
          )}
          {student.slack_username && (
            <InfoRow icon={MessageSquare} label="Slack">
              {student.slack_username}
            </InfoRow>
          )}
          {student.linkedin_url && (
            <InfoRow icon={Globe} label="LinkedIn">
              <a href={student.linkedin_url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                {student.linkedin_url.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            </InfoRow>
          )}
          {student.github_url && (
            <InfoRow icon={Globe} label="GitHub">
              <a href={student.github_url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                {student.github_url.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            </InfoRow>
          )}
          {student.discord_handle && (
            <InfoRow icon={MessageSquare} label="Discord">
              {student.discord_handle}
            </InfoRow>
          )}
          {student.wallet_address && (
            <InfoRow icon={Wallet} label="Wallet">
              <span className="font-mono text-xs break-all">{student.wallet_address}</span>
            </InfoRow>
          )}
        </IconSection>

        <IconSection title="Cohort Information" icon={Calendar}>
          <InfoRow icon={Calendar} label="Cohort">
            {cohortName ?? 'Not in a cohort'}
          </InfoRow>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Attendance</span>
              <span className="font-medium text-foreground">
                {attendanceRate === null ? 'No records' : `${attendanceRate}%`}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-success" style={{ width: `${attendanceRate ?? 0}%` }} />
            </div>
          </div>
          <InfoRow icon={CheckCircle2} label="Last session">
            {lastSession
              ? `${lastSession.title} (${formatDate(lastSession.start_time)}) · ${lastRecord.status}`
              : 'No attendance recorded yet'}
          </InfoRow>
          {sortedAttendance.length > 1 && (
            <ul className="space-y-1.5 border-t border-border pt-3">
              {sortedAttendance.slice(1).map((record) => (
                <li key={record.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">
                    {sessionsById.get(record.session_id)?.title ?? 'Session'}
                  </span>
                  <Pill
                    tone={
                      record.status === 'present'
                        ? 'success'
                        : record.status === 'excused'
                          ? 'muted'
                          : 'destructive'
                    }
                    className="px-2 py-0.5 text-[10px] capitalize"
                  >
                    {record.status}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </IconSection>

        <IconSection title="Update Stage" icon={Save}>
          <p className="text-xs text-muted-foreground">
            Only mentors and admins can change the project stage.
          </p>
          {project ? (
            <StageForwardSelect project={project} onSaved={setProject} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {firstName} hasn't created a project yet.
            </p>
          )}
        </IconSection>
      </div>

      <IconSection title="Project Summary" icon={ExternalLink}>
        {project ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Project name" value={project.name} />
            <Field label="Current stage" value={stageLabels[project.current_stage]} />
            <Field label="Problem" value={project.problem_statement} />
            <Field label="Solution" value={project.solution} />
            <Field label="Target users" value={project.target_users} />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Project links</p>
              {project.repo_url ||
              project.demo_url ||
              project.figma_url ||
              project.notion_url ||
              project.pitch_deck_url ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  <ExternalRow label="GitHub" href={project.repo_url} />
                  <ExternalRow label="Demo" href={project.demo_url} />
                  <ExternalRow label="Figma" href={project.figma_url} />
                  <ExternalRow label="Notion" href={project.notion_url} />
                  <ExternalRow label="Pitch deck" href={project.pitch_deck_url} />
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No links added yet.</p>
              )}
            </div>
            {project.description && (
              <div className="md:col-span-2">
                <Field label="Description" value={project.description} />
              </div>
            )}
          </div>
        ) : (
          <EmptyState>This student hasn't created a project yet.</EmptyState>
        )}
      </IconSection>

      <IconSection title="Progress Timeline" icon={Calendar}>
        {updates.length === 0 && earlierFeedback.length === 0 ? (
          <EmptyState>No progress updates yet.</EmptyState>
        ) : (
          <ol className="relative space-y-6 border-l border-border pl-6">
            {updates.map((u) => {
              const fb = feedbackByUpdate.get(u.id) ?? []
              const status = reviewStatus(u, fb)
              const related = u.related_session_id ? sessionsById.get(u.related_session_id) : undefined
              return (
                <li key={u.id} className="relative">
                  <span className="absolute top-1.5 -left-[29px] flex size-3 items-center justify-center rounded-full border-2 border-primary bg-card" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {formatDate(u.created_at)}
                      </p>
                      <Pill tone={reviewStatusMeta[status].tone} className="px-2 py-0.5 text-[10px]">
                        {reviewStatusMeta[status].label}
                      </Pill>
                    </div>
                    <Link
                      to={`/mentor/reviews/${u.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Review update
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FieldBlock label="Worked on">{u.summary}</FieldBlock>
                    <FieldBlock label="Learned / discovered">{u.learned || '—'}</FieldBlock>
                    <FieldBlock label="Blockers" tone={u.blockers ? 'warn' : 'default'}>
                      {u.blockers || 'None reported.'}
                    </FieldBlock>
                    <FieldBlock label="Next steps">{u.next_steps || '—'}</FieldBlock>
                  </div>
                  {(u.links.length > 0 || related) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {related && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Clock className="size-3" /> Related session: {related.title}
                        </span>
                      )}
                      {u.links.map((href) => (
                        <a
                          key={href}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {href.replace(/^https?:\/\//, '')}
                          <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  )}
                  {fb.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {fb.map((c) => (
                        <FeedbackNote key={c.id} comment={c} mentorName={mentorNames.get(c.mentor_id)} />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground italic">No mentor feedback yet.</p>
                  )}
                </li>
              )
            })}
            {earlierFeedback.length > 0 && (
              <li className="relative">
                <span className="absolute top-1.5 -left-[29px] flex size-3 items-center justify-center rounded-full border-2 border-border bg-card" />
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  General project feedback
                </p>
                <div className="mt-2 space-y-2">
                  {earlierFeedback.map((c) => (
                    <FeedbackNote key={c.id} comment={c} mentorName={mentorNames.get(c.mentor_id)} />
                  ))}
                </div>
              </li>
            )}
          </ol>
        )}
      </IconSection>

      <IconSection title="Leave Feedback" icon={MessageSquare}>
        <p className="text-xs text-muted-foreground">
          {latestUpdate
            ? `Feedback is shared with ${firstName} and attached to their latest progress update (${formatDateTime(latestUpdate.created_at)}).`
            : `Feedback is shared with ${firstName} as general project feedback.`}
        </p>
        <form className="space-y-3" onSubmit={handleSubmitFeedback}>
          <Textarea
            rows={5}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={
              project
                ? 'Share encouragement, concrete next steps, or things to unblock…'
                : 'Feedback is available once the student has a project.'
            }
            disabled={!project}
          />
          <div className="flex items-center justify-between gap-3">
            {feedbackError ? <p className="text-xs text-destructive">{feedbackError}</p> : <span />}
            <Button type="submit" size="sm" disabled={!project || submitting || !feedback.trim()}>
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Submit feedback
            </Button>
          </div>
        </form>
      </IconSection>
    </Page>
  )
}
