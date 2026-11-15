import * as React from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquareText,
  Save,
  Send,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Page } from '@/components/PageHeader'
import { Pill } from '@/components/Panel'
import { FieldBlock, IconSection } from '@/components/IconSection'
import { StageForwardSelect } from '@/components/StageForwardSelect'
import { FeedbackNote } from '@/components/FeedbackNote'
import { PageLoading } from '@/components/PageStatus'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  createMentorComment,
  getProjectByStudentId,
  getUser,
  getUserNames,
  listMentorComments,
  listProgressUpdatesByStudent,
  listSessions,
} from '@/data/queries'
import {
  daysSince,
  errorMessage,
  getMentorComment,
  getProgressUpdate,
  groupFeedbackByUpdate,
  listCohortNames,
  reviewStatus,
  reviewStatusMeta,
} from '@/data/queries-mentor'
import { formatDate, stageLabels } from '@/lib/format'
import type { MentorComment, Project, ProgressUpdate, Session, User } from '@/types'

function relativeDays(iso: string) {
  const d = daysSince(iso)
  if (d <= 0) return 'Today'
  if (d === 1) return '1 day ago'
  return `${d} days ago`
}

function BackLink() {
  return (
    <Link
      to="/mentor/reviews"
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to Reviews
    </Link>
  )
}

function InfoLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
    </div>
  )
}

export function MentorReviewDetail() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [update, setUpdate] = React.useState<ProgressUpdate | null>(null)
  const [student, setStudent] = React.useState<User | null>(null)
  const [project, setProject] = React.useState<Project | null>(null)
  const [studentUpdates, setStudentUpdates] = React.useState<ProgressUpdate[]>([])
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [relatedSession, setRelatedSession] = React.useState<Session | null>(null)
  const [mentorNames, setMentorNames] = React.useState<Map<string, string>>(new Map())
  const [cohortName, setCohortName] = React.useState<string | undefined>()
  const [redirectTo, setRedirectTo] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!reviewId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const found = await getProgressUpdate(reviewId)
      if (!found) {
        // Older links pointed at a feedback comment id — send those to the
        // update it belongs to, or to the student's page.
        const comment = await getMentorComment(reviewId)
        if (!cancelled && comment) {
          setRedirectTo(
            comment.progress_update_id
              ? `/mentor/reviews/${comment.progress_update_id}`
              : `/mentor/students/${comment.student_id}`,
          )
        }
        return
      }
      const [s, p, u, c, sessions, cohorts] = await Promise.all([
        getUser(found.student_id),
        getProjectByStudentId(found.student_id),
        listProgressUpdatesByStudent(found.student_id),
        listMentorComments({ studentId: found.student_id }),
        found.related_session_id ? listSessions() : Promise.resolve([] as Session[]),
        listCohortNames(),
      ])
      const names = await getUserNames([...new Set(c.map((x) => x.mentor_id))])
      if (cancelled) return
      setUpdate(found)
      setStudent(s)
      setProject(p)
      setStudentUpdates(u)
      setComments(c)
      setRelatedSession(sessions.find((x) => x.id === found.related_session_id) ?? null)
      setCohortName(s.cohort_id ? cohorts.get(s.cohort_id) : undefined)
      setMentorNames(new Map(names.map((n) => [n.id, n.full_name])))
    })()
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Failed to load review'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reviewId])

  async function handleSaveFeedback(e: React.FormEvent) {
    e.preventDefault()
    if (!feedback.trim() || !update || !student) return
    setSubmitting(true)
    setFeedbackError(null)
    try {
      const created = await createMentorComment({
        project_id: update.project_id,
        mentor_id: user.id,
        student_id: student.id,
        comment: feedback.trim(),
        progress_update_id: update.id,
      })
      setComments((prev) => [created, ...prev])
      setMentorNames((prev) => new Map(prev).set(user.id, user.full_name))
      setFeedback('')
      showToast('Feedback saved — update marked as reviewed')
    } catch (err) {
      const message = errorMessage(err, 'Failed to save feedback')
      setFeedbackError(message)
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (redirectTo) return <Navigate to={redirectTo} replace />
  if (loading) return <PageLoading />

  if (loadError || !update || !student) {
    return (
      <Page>
        <BackLink />
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          {loadError ?? 'Review not found.'}
        </div>
      </Page>
    )
  }

  const feedbackForUpdate = groupFeedbackByUpdate(studentUpdates, comments).get(update.id) ?? []
  const status = reviewStatus(update, feedbackForUpdate)
  const meta = reviewStatusMeta[status]
  const firstName = student.full_name.split(' ')[0]

  return (
    <Page>
      <div>
        <BackLink />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              {cohortName ? `Mentor · ${cohortName}` : 'Mentor'}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Review Update</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {student.full_name} · {project?.name ?? 'Project'}
            </p>
          </div>
          <Pill tone={meta.tone}>{meta.label}</Pill>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <IconSection title="Student Information" icon={UserIcon}>
          <InfoLine label="Name">{student.full_name}</InfoLine>
          <InfoLine label="Project">{project?.name ?? '—'}</InfoLine>
          <InfoLine label="Current Stage">{project ? stageLabels[project.current_stage] : '—'}</InfoLine>
          <InfoLine label="Submitted">
            {relativeDays(update.created_at)} · {formatDate(update.created_at)}
          </InfoLine>
        </IconSection>

        <IconSection title="Project Stage" icon={CheckCircle2}>
          <p className="text-xs text-muted-foreground">Update the student's current project stage.</p>
          {project ? (
            <StageForwardSelect project={project} onSaved={setProject} />
          ) : (
            <p className="text-sm text-muted-foreground">No project found for this student.</p>
          )}
        </IconSection>

        <IconSection title="Actions" icon={Send}>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to={`/mentor/students/${student.id}`}>
              <UserIcon className="size-3.5" />
              View full student profile
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={`mailto:${student.email}`}>
              <Mail className="size-3.5" />
              Email {firstName}
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            An update counts as reviewed once feedback is saved on it.
          </p>
        </IconSection>
      </div>

      <IconSection title="Progress Update" icon={Clock}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldBlock label="Worked On">{update.summary}</FieldBlock>
          <FieldBlock label="Learned / Discovered">{update.learned || '—'}</FieldBlock>
          <FieldBlock label="Blockers" tone={update.blockers ? 'warn' : 'default'}>
            {update.blockers || 'None reported.'}
          </FieldBlock>
          <FieldBlock label="Next Steps">{update.next_steps || '—'}</FieldBlock>
        </div>
        {(update.links.length > 0 || relatedSession) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {relatedSession && (
              <span className="text-muted-foreground">Related session: {relatedSession.title}</span>
            )}
            {update.links.map((href) => (
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
      </IconSection>

      <IconSection title="Mentor Feedback" icon={MessageSquareText}>
        {feedbackForUpdate.length > 0 && (
          <div className="space-y-2">
            {feedbackForUpdate.map((c) => (
              <FeedbackNote key={c.id} comment={c} mentorName={mentorNames.get(c.mentor_id)} />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Share encouragement, concrete next steps, or things to unblock for {firstName}.
        </p>
        <form className="space-y-3" onSubmit={handleSaveFeedback}>
          <Textarea
            rows={6}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Write your feedback here…"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {feedbackError ? <p className="text-xs text-destructive">{feedbackError}</p> : <span />}
            <Button type="submit" size="sm" disabled={submitting || !feedback.trim()}>
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save Feedback
            </Button>
          </div>
        </form>
      </IconSection>
    </Page>
  )
}
