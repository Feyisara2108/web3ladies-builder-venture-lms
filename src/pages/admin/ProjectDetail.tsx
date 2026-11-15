import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExternalLink, FolderKanban, LineChart, Loader2, Mail, MessageSquareText, Star, UserCog } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Page } from '@/components/PageHeader'
import { EmptyState, Panel, PanelHeader, PanelItem } from '@/components/Panel'
import { BackLink, InfoTile, NotFoundState, PageError, PageLoading } from '@/components/PageState'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  assignMentorToStudents,
  listCohorts,
  listMentorAssignments,
  listMentorComments,
  listUsers,
  unassignMentorFromStudent,
  updateProjectStage,
} from '@/data/queries'
import { getProject, listProgressUpdatesForProject } from '@/data/queries-admin'
import { formatDate, stageLabels, stageOrder } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Cohort, MentorAssignment, MentorComment, Project, ProjectStage, ProgressUpdate, User } from '@/types'
import { projectHealth, projectHealthTone, relativeTime, stageTone } from './helpers'

function ReassignMentorDialog({
  student,
  mentors,
  assignments,
  onChanged,
}: {
  student: User
  mentors: User[]
  assignments: MentorAssignment[]
  onChanged: (next: MentorAssignment[]) => void
}) {
  const { user: admin } = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setSelected(new Set(assignments.map((a) => a.mentor_id)))
      setError(null)
    }
  }, [open, assignments])

  // Mentors in the student's cohort first, then everyone else.
  const sorted = [...mentors].sort((a, b) => {
    const aIn = a.cohort_id === student.cohort_id ? 0 : 1
    const bIn = b.cohort_id === student.cohort_id ? 0 : 1
    return aIn - bIn || a.full_name.localeCompare(b.full_name)
  })

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      const current = new Set(assignments.map((a) => a.mentor_id))
      const toAdd = [...selected].filter((id) => !current.has(id))
      const toRemove = [...current].filter((id) => !selected.has(id))
      await Promise.all([
        ...toAdd.map((mentorId) => assignMentorToStudents(mentorId, [student.id], admin.id)),
        ...toRemove.map((mentorId) => unassignMentorFromStudent(mentorId, student.id)),
      ])
      onChanged(await listMentorAssignments({ studentIds: [student.id] }))
      setOpen(false)
      showToast('Mentor assignment updated')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update mentor assignment'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-lg">
          <UserCog className="size-4" /> Reassign Mentor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mentors for {student.full_name}</DialogTitle>
          <DialogDescription>Choose which mentors are responsible for this student.</DialogDescription>
        </DialogHeader>
        {mentors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mentors exist yet — invite one from the Users page.</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border p-2">
            {sorted.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                />
                {m.full_name}
                {m.cohort_id !== student.cohort_id && (
                  <span className="text-xs text-muted-foreground">(other cohort)</span>
                )}
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button onClick={handleSave} disabled={busy || mentors.length === 0}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Block({ title, body }: { title: string; body?: string | null }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{body || 'Not provided yet.'}</p>
    </div>
  )
}

export function AdminProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const { showToast } = useToast()

  const [project, setProject] = React.useState<Project | null>(null)
  const [users, setUsers] = React.useState<User[]>([])
  const [cohorts, setCohorts] = React.useState<Cohort[]>([])
  const [assignments, setAssignments] = React.useState<MentorAssignment[]>([])
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [notFound, setNotFound] = React.useState(false)
  const [stageSaving, setStageSaving] = React.useState(false)

  React.useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoading(true)
    getProject(projectId)
      .then(async (projectData) => {
        const [userData, cohortData, assignmentData, updateData, commentData] = await Promise.all([
          listUsers(),
          listCohorts(),
          listMentorAssignments({ studentIds: [projectData.student_id] }),
          listProgressUpdatesForProject(projectData.id),
          listMentorComments({ projectId: projectData.id }),
        ])
        if (cancelled) return
        setProject(projectData)
        setUsers(userData)
        setCohorts(cohortData)
        setAssignments(assignmentData)
        setUpdates(updateData)
        setComments(commentData)
      })
      .catch((err) => {
        if (cancelled) return
        if (typeof err === 'object' && err && 'code' in err && err.code === 'PGRST116') setNotFound(true)
        else setLoadError(getErrorMessage(err, 'Failed to load project'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function handleStageChange(stage: ProjectStage) {
    if (!project) return
    setStageSaving(true)
    try {
      setProject(await updateProjectStage(project.id, stage))
      showToast(`Stage set to ${stageLabels[stage]}`)
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update stage'), 'error')
    } finally {
      setStageSaving(false)
    }
  }

  if (loading) return <PageLoading className="min-h-[60vh]" />

  if (notFound || !project) {
    if (loadError) {
      return (
        <Page>
          <BackLink to="/admin/projects">Back to Projects</BackLink>
          <PageError>{loadError}</PageError>
        </Page>
      )
    }
    return (
      <NotFoundState
        icon={FolderKanban}
        title="Project not found"
        description="This project does not exist or has been removed."
        backTo="/admin/projects"
        backLabel="Back to Projects"
      />
    )
  }

  const student = users.find((u) => u.id === project.student_id)
  const cohort = cohorts.find((c) => c.id === project.cohort_id)
  const mentors = users.filter((u) => u.role === 'mentor')
  const nameOf = (id: string) => users.find((u) => u.id === id)?.full_name ?? 'Unknown'
  const mentorNames = assignments.map((a) => nameOf(a.mentor_id)).join(', ')
  const lastUpdate = updates[0]?.created_at ?? null
  const health = projectHealth(project.current_stage, lastUpdate)

  const links = [
    { label: 'Demo', url: project.demo_url },
    { label: 'GitHub', url: project.repo_url },
    { label: 'Pitch deck', url: project.pitch_deck_url },
    { label: 'Figma', url: project.figma_url },
    { label: 'Notion', url: project.notion_url },
  ].filter((l): l is { label: string; url: string } => !!l.url)

  return (
    <Page>
      <BackLink to="/admin/projects">Back to Projects</BackLink>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Project</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag tone={stageTone[project.current_stage]}>{stageLabels[project.current_stage]}</Tag>
            <Tag tone={projectHealthTone[health]} className="capitalize">
              {health}
            </Tag>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Stage</span>
            <Select
              value={project.current_stage}
              onValueChange={(v) => handleStageChange(v as ProjectStage)}
              disabled={stageSaving}
            >
              <SelectTrigger className="h-9 w-36 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stageOrder.map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stageSaving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          {student && (
            <ReassignMentorDialog
              student={student}
              mentors={mentors}
              assignments={assignments}
              onChanged={setAssignments}
            />
          )}
          {student && (
            <Button className="rounded-lg px-3" asChild>
              <a href={`mailto:${student.email}`}>
                <Mail className="size-4" /> Message Student
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile
          label="Student"
          value={
            student ? (
              <Link to={`/admin/users/${student.id}`} className="hover:underline">
                {student.full_name}
              </Link>
            ) : (
              '—'
            )
          }
        />
        <InfoTile
          label="Cohort"
          value={
            cohort ? (
              <Link to={`/admin/cohorts/${cohort.id}`} className="hover:underline">
                {cohort.name}
              </Link>
            ) : (
              '—'
            )
          }
        />
        <InfoTile label="Mentor" value={mentorNames || 'Unassigned'} />
        <InfoTile label="Last Update" value={lastUpdate ? formatDate(lastUpdate) : 'No updates yet'} />
      </div>

      <Panel className="space-y-5 p-6">
        <Block title="Problem" body={project.problem_statement} />
        <Block title="Solution" body={project.solution} />
        <Block title="Target Users" body={project.target_users} />
        {project.description && <Block title="Description" body={project.description} />}
      </Panel>

      <Panel className="p-6">
        <h2 className="text-sm font-semibold">Project Links</h2>
        {links.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No links submitted yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  {l.label} <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            icon={LineChart}
            title="Progress updates"
            action={<span className="text-xs text-muted-foreground">{updates.length} total</span>}
          />
          {updates.length === 0 ? (
            <EmptyState>No progress updates yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {updates.slice(0, 8).map((u) => (
                <PanelItem key={u.id}>
                  <p className="text-sm whitespace-pre-line">{u.summary}</p>
                  {u.blockers && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Blockers:</span> {u.blockers}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{relativeTime(u.created_at)}</p>
                </PanelItem>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            icon={MessageSquareText}
            title="Mentor feedback"
            action={<span className="text-xs text-muted-foreground">{comments.length} total</span>}
          />
          {comments.length === 0 ? (
            <EmptyState>No mentor feedback yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {comments.slice(0, 8).map((c) => (
                <PanelItem key={c.id}>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{nameOf(c.mentor_id)}</span>
                    <span className="flex items-center gap-2">
                      {c.rating && (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="size-3 fill-current text-amber-500" /> {c.rating}/5
                        </span>
                      )}
                      {relativeTime(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-line">{c.comment}</p>
                </PanelItem>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Page>
  )
}
