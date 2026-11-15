import * as React from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Link as LinkIcon, Loader2, MessageSquareText, Plus, Send } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, Panel, PanelHeader } from '@/components/Panel'
import {
  createProgressUpdate,
  getProjectByStudentId,
  getUserNames,
  listMentorComments,
  listProgressUpdatesByStudent,
  listSessions,
} from '@/data/queries'
import { timeAgo } from '@/lib/format'
import { cn, getErrorMessage } from '@/lib/utils'
import type { MentorComment, Project, ProgressUpdate, Session } from '@/types'

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'

const emptyDraft = { worked_on: '', learned: '', blockers: '', next_steps: '', links: '', related_session_id: '' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function Block({
  label,
  children,
  tone = 'default',
}: {
  label: string
  children: React.ReactNode
  tone?: 'default' | 'warn'
}) {
  return (
    <div>
      <div
        className={cn(
          'text-xs font-medium uppercase tracking-wide',
          tone === 'warn' ? 'text-warning-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </div>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{children}</p>
    </div>
  )
}

function CommentBubble({ comment, mentorName }: { comment: MentorComment; mentorName: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{mentorName}</span>
        <span className="text-muted-foreground">{timeAgo(comment.created_at)}</span>
      </div>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{comment.comment}</p>
    </div>
  )
}

export function StudentProgress() {
  const { user } = useAuth()
  const [project, setProject] = React.useState<Project | null>(null)
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [mentorNames, setMentorNames] = React.useState<Map<string, string>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [showForm, setShowForm] = React.useState(false)
  const [draft, setDraft] = React.useState(emptyDraft)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      getProjectByStudentId(user.id),
      listProgressUpdatesByStudent(user.id),
      listMentorComments({ studentId: user.id }),
      listSessions(),
    ])
      .then(async ([projectData, updateData, commentData, sessionData]) => {
        const names = await getUserNames([...new Set(commentData.map((c) => c.mentor_id))])
        if (cancelled) return
        setProject(projectData)
        setUpdates(updateData)
        setComments(commentData)
        setSessions(
          sessionData
            .filter((s) => s.cohort_id === user.cohort_id && s.status !== 'cancelled')
            .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
        )
        setMentorNames(new Map(names.map((n) => [n.id, n.full_name])))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load updates'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id, user.cohort_id])

  function set(field: keyof typeof emptyDraft) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.worked_on.trim() || !project) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const created = await createProgressUpdate({
        project_id: project.id,
        student_id: user.id,
        summary: draft.worked_on.trim(),
        learned: draft.learned.trim() || undefined,
        blockers: draft.blockers.trim() || undefined,
        next_steps: draft.next_steps.trim() || undefined,
        links: draft.links
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        related_session_id: draft.related_session_id || undefined,
      })
      setUpdates((prev) => [created, ...prev])
      setDraft(emptyDraft)
      setShowForm(false)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Failed to post update'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const sessionTitle = new Map(sessions.map((s) => [s.id, s.title]))
  const pastSessions = sessions.filter((s) => new Date(s.start_time).getTime() <= Date.now())
  const commentsByUpdate = new Map<string, MentorComment[]>()
  const generalComments: MentorComment[] = []
  for (const c of comments) {
    if (c.progress_update_id) {
      const list = commentsByUpdate.get(c.progress_update_id) ?? []
      list.push(c)
      commentsByUpdate.set(c.progress_update_id, list)
    } else {
      generalComments.push(c)
    }
  }
  const nameOf = (id: string) => mentorNames.get(id) ?? 'Mentor'

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow="Builder log"
        title="Progress Updates"
        description="Post whenever you ship, learn, or hit a wall. No fixed cadence."
        action={
          project && (
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" />
              New update
            </button>
          )
        }
      />

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {!project && (
        <EmptyState>
          You need a project before you can post updates.{' '}
          <Link to="/workspace" className="text-primary hover:underline">
            Start one on your Project page
          </Link>
          .
        </EmptyState>
      )}

      {showForm && project && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Share what you've been up to</h2>
          <Field label="What did you work on?">
            <textarea required rows={3} className={inputCls} value={draft.worked_on} onChange={set('worked_on')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="What did you learn or discover?">
              <textarea rows={3} className={inputCls} value={draft.learned} onChange={set('learned')} />
            </Field>
            <Field label="Any blockers?">
              <textarea rows={3} className={inputCls} value={draft.blockers} onChange={set('blockers')} />
            </Field>
          </div>
          <Field label="Next steps">
            <textarea rows={2} className={inputCls} value={draft.next_steps} onChange={set('next_steps')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Links (comma-separated)">
              <input
                className={inputCls}
                placeholder="https://github.com/... , https://figma.com/..."
                value={draft.links}
                onChange={set('links')}
              />
            </Field>
            <Field label="Related session (optional)">
              <select className={inputCls} value={draft.related_session_id} onChange={set('related_session_id')}>
                <option value="">None</option>
                {pastSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Post update
            </button>
          </div>
        </form>
      )}

      {generalComments.length > 0 && (
        <Panel>
          <PanelHeader icon={MessageSquareText} title="Mentor feedback on your project" />
          <div className="space-y-3">
            {generalComments.map((c) => (
              <CommentBubble key={c.id} comment={c} mentorName={nameOf(c.mentor_id)} />
            ))}
          </div>
        </Panel>
      )}

      {project && updates.length === 0 && !showForm && (
        <EmptyState>No updates yet. Click "New update" to post your first one.</EmptyState>
      )}

      {updates.length > 0 && (
        <div className="relative space-y-6">
          <div className="absolute bottom-2 left-3 top-2 w-px bg-border" aria-hidden />
          {updates.map((u) => {
            const updateComments = commentsByUpdate.get(u.id) ?? []
            const related = u.related_session_id ? sessionTitle.get(u.related_session_id) : undefined
            return (
              <article key={u.id} className="relative pl-10">
                <div className="absolute left-0 top-2 flex size-6 items-center justify-center rounded-full border border-border bg-card">
                  <LineChart className="size-3 text-primary" />
                </div>
                <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{timeAgo(u.created_at)}</span>
                    {related && <span className="truncate rounded-full bg-muted px-2 py-0.5">{related}</span>}
                  </div>
                  <Block label="Worked on">{u.summary}</Block>
                  {u.learned && <Block label="Learned / discovered">{u.learned}</Block>}
                  {u.blockers && (
                    <Block label="Blockers" tone="warn">
                      {u.blockers}
                    </Block>
                  )}
                  {u.next_steps && <Block label="Next steps">{u.next_steps}</Block>}
                  {u.links?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {u.links.map((href) => (
                        <a
                          key={href}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-primary hover:bg-muted"
                        >
                          <LinkIcon className="size-3" />
                          {href.replace(/^https?:\/\//, '').slice(0, 40)}
                        </a>
                      ))}
                    </div>
                  )}
                  {updateComments.length > 0 && (
                    <div className="space-y-3 border-t border-border pt-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <MessageSquareText className="size-3.5" /> Mentor feedback
                      </div>
                      {updateComments.map((c) => (
                        <CommentBubble key={c.id} comment={c} mentorName={nameOf(c.mentor_id)} />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
