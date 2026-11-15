import * as React from 'react'
import {
  BookOpen,
  FileText,
  FolderKanban,
  GitBranch,
  Globe,
  Loader2,
  PenTool,
  Lock,
  MessageSquareText,
  Save,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Page, PageHeader } from '@/components/PageHeader'
import { EmptyState, Panel, PanelHeader, PanelItem, Pill } from '@/components/Panel'
import {
  createProject,
  getProjectByStudentId,
  listMentorComments,
  updateProjectDetails,
} from '@/data/queries'
import { stageLabels, stageOrder, timeAgo } from '@/lib/format'
import { cn, getErrorMessage } from '@/lib/utils'
import type { MentorComment, Project } from '@/types'

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring'

function Field({
  label,
  hint,
  icon,
  children,
  className,
}: {
  label: string
  hint?: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {icon}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

const emptyForm = {
  name: '',
  problem_statement: '',
  solution: '',
  target_users: '',
  description: '',
  repo_url: '',
  demo_url: '',
  figma_url: '',
  notion_url: '',
  pitch_deck_url: '',
}
type ProjectForm = typeof emptyForm

function formFromProject(p: Project): ProjectForm {
  return {
    name: p.name ?? '',
    problem_statement: p.problem_statement ?? '',
    solution: p.solution ?? '',
    target_users: p.target_users ?? '',
    description: p.description ?? '',
    repo_url: p.repo_url ?? '',
    demo_url: p.demo_url ?? '',
    figma_url: p.figma_url ?? '',
    notion_url: p.notion_url ?? '',
    pitch_deck_url: p.pitch_deck_url ?? '',
  }
}

function CreateProjectCard({ onCreated }: { onCreated: (project: Project) => void }) {
  const { user } = useAuth()
  const [form, setForm] = React.useState({ name: '', problem_statement: '', solution: '' })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!user.cohort_id) {
    return (
      <EmptyState>
        You're not in a cohort yet, so you can't start a project. Ask your admin to add you to one.
      </EmptyState>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !user.cohort_id) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createProject({
        student_id: user.id,
        cohort_id: user.cohort_id,
        name: form.name.trim(),
        problem_statement: form.problem_statement || undefined,
        solution: form.solution || undefined,
      })
      onCreated(created)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create project'))
      setSubmitting(false)
    }
  }

  return (
    <Panel>
      <PanelHeader
        icon={Sparkles}
        title="Start your project"
        description="Give it a working name. You can change everything later, and your mentor will move it through the stages."
      />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Project name">
          <input
            className={inputCls}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Problem (optional)">
          <textarea
            rows={2}
            className={inputCls}
            value={form.problem_statement}
            onChange={(e) => setForm((f) => ({ ...f, problem_statement: e.target.value }))}
          />
        </Field>
        <Field label="Solution (optional)">
          <textarea
            rows={2}
            className={inputCls}
            value={form.solution}
            onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !form.name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Create project
        </button>
      </form>
    </Panel>
  )
}

export function StudentWorkspace() {
  const { user } = useAuth()
  const [project, setProject] = React.useState<Project | null>(null)
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<ProjectForm>(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    getProjectByStudentId(user.id)
      .then(async (projectData) => {
        if (cancelled) return
        setProject(projectData)
        if (projectData) {
          setForm(formFromProject(projectData))
          const commentData = await listMentorComments({ projectId: projectData.id })
          if (!cancelled) setComments(commentData)
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load project')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

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

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        <PageHeader eyebrow="Builder workspace" title="Project" description="You don't have a project yet." />
        <CreateProjectCard
          onCreated={(created) => {
            setProject(created)
            setForm(formFromProject(created))
          }}
        />
      </div>
    )
  }

  function update(field: keyof ProjectForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setSaved(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!project) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateProjectDetails(project.id, form)
      setProject(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save project'))
    } finally {
      setSaving(false)
    }
  }

  const stageIndex = stageOrder.indexOf(project.current_stage)

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow="Builder workspace"
        title="Project"
        description="Keep your project details current. Your mentor reviews this each week."
        action={
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saved ? 'Saved' : 'Save changes'}
          </button>
        }
      />
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <Panel>
        <PanelHeader icon={Sparkles} title="Identity" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Project name">
            <input className={inputCls} value={form.name} onChange={update('name')} />
          </Field>
          <Field label="Current stage" hint="Updated by mentor/admin — read only" icon={<Lock className="size-3" />}>
            <div className="flex items-center gap-2">
              <Pill>{stageLabels[project.current_stage]}</Pill>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${((stageIndex + 1) / stageOrder.length) * 100}%` }}
                />
              </div>
            </div>
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader icon={FolderKanban} title="Problem & solution" />
        <div className="space-y-4">
          <Field label="Problem">
            <textarea rows={3} className={inputCls} value={form.problem_statement} onChange={update('problem_statement')} />
          </Field>
          <Field label="Solution">
            <textarea rows={3} className={inputCls} value={form.solution} onChange={update('solution')} />
          </Field>
          <Field label="Target users">
            <textarea rows={2} className={inputCls} value={form.target_users} onChange={update('target_users')} />
          </Field>
          <Field label="Description">
            <textarea rows={3} className={inputCls} value={form.description} onChange={update('description')} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader icon={Globe} title="Project links" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="GitHub" icon={<GitBranch className="size-3" />}>
            <input type="url" className={inputCls} value={form.repo_url} onChange={update('repo_url')} />
          </Field>
          <Field label="Demo" icon={<Globe className="size-3" />}>
            <input type="url" className={inputCls} value={form.demo_url} onChange={update('demo_url')} />
          </Field>
          <Field label="Figma" icon={<PenTool className="size-3" />}>
            <input type="url" className={inputCls} value={form.figma_url} onChange={update('figma_url')} />
          </Field>
          <Field label="Notion" icon={<BookOpen className="size-3" />}>
            <input type="url" className={inputCls} value={form.notion_url} onChange={update('notion_url')} />
          </Field>
          <Field label="Pitch deck" icon={<FileText className="size-3" />} className="md:col-span-2">
            <input type="url" className={inputCls} value={form.pitch_deck_url} onChange={update('pitch_deck_url')} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader icon={MessageSquareText} title="Mentor feedback" description="Comments from your mentors on this project." />
        {comments.length === 0 ? (
          <EmptyState>No feedback yet.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <PanelItem key={c.id}>
                <div className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</div>
                <p className="mt-1 text-sm leading-relaxed">{c.comment}</p>
              </PanelItem>
            ))}
          </ul>
        )}
      </Panel>
    </form>
  )
}
