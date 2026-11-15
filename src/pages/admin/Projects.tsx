import * as React from 'react'
import { Activity, Download, FolderKanban, Hammer, Loader2, Plus, Rocket, SlidersHorizontal } from 'lucide-react'
import { Page, PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { DataTable, EmptyRow, RowLink, Td, Tr } from '@/components/DataTable'
import { SearchInput, SelectFilter } from '@/components/ListControls'
import { PageError, PageLoading } from '@/components/PageState'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { createProject, listCohorts, listMentorAssignments, listProjects, listUsers } from '@/data/queries'
import { listAllProgressUpdates } from '@/data/queries-admin'
import { formatDate, stageLabels, stageOrder } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Cohort, MentorAssignment, Project, User } from '@/types'
import { latestUpdateByProject, projectHealth, projectHealthTone, stageTone } from './helpers'

function CreateProjectDialog({
  users,
  projects,
  onCreated,
}: {
  users: User[]
  projects: Project[]
  onCreated: (p: Project) => void
}) {
  const { showToast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ student_id: '', name: '', problem_statement: '', solution: '' })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const studentsWithoutProject = users.filter(
    (u) => u.role === 'student' && !projects.some((p) => p.student_id === u.id),
  )
  const selectedStudent = studentsWithoutProject.find((u) => u.id === form.student_id)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !selectedStudent?.cohort_id) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createProject({
        student_id: selectedStudent.id,
        cohort_id: selectedStudent.cohort_id,
        name: form.name,
        problem_statement: form.problem_statement || undefined,
        solution: form.solution || undefined,
      })
      onCreated(created)
      setForm({ student_id: '', name: '', problem_statement: '', solution: '' })
      setOpen(false)
      showToast('Project created')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create project'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-lg">
          <Plus className="size-4" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Set up a project record so a student can start working in their Workspace.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          <div className="flex flex-col gap-2">
            <Label>Student</Label>
            {studentsWithoutProject.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every student already has a project.</p>
            ) : (
              <Select value={form.student_id} onValueChange={(v) => setForm((f) => ({ ...f, student_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {studentsWithoutProject.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {form.student_id && !selectedStudent?.cohort_id && (
              <p className="text-xs text-destructive">
                This student has no cohort assigned yet — set that first (Users page) before creating
                their project.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="problem-statement">Problem statement (optional)</Label>
            <Textarea
              id="problem-statement"
              rows={2}
              value={form.problem_statement}
              onChange={(e) => setForm((f) => ({ ...f, problem_statement: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="solution">Solution (optional)</Label>
            <Textarea
              id="solution"
              rows={2}
              value={form.solution}
              onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting || !form.student_id || !form.name || !selectedStudent?.cohort_id}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function AdminProjects() {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [cohorts, setCohorts] = React.useState<Cohort[]>([])
  const [users, setUsers] = React.useState<User[]>([])
  const [assignments, setAssignments] = React.useState<MentorAssignment[]>([])
  const [lastUpdate, setLastUpdate] = React.useState<Map<string, string>>(new Map())
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [query, setQuery] = React.useState('')
  const [cohortFilter, setCohortFilter] = React.useState('all')
  const [mentorFilter, setMentorFilter] = React.useState('all')
  const [stageFilter, setStageFilter] = React.useState('all')

  React.useEffect(() => {
    let cancelled = false
    Promise.all([listProjects(), listCohorts(), listUsers(), listMentorAssignments(), listAllProgressUpdates()])
      .then(([projectData, cohortData, userData, assignmentData, updateData]) => {
        if (cancelled) return
        setProjects(projectData)
        setCohorts(cohortData)
        setUsers(userData)
        setAssignments(assignmentData)
        setLastUpdate(latestUpdateByProject(updateData))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load projects'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const nameOf = (id: string) => users.find((u) => u.id === id)?.full_name ?? '—'
  const mentorIdsFor = (studentId: string) =>
    assignments.filter((a) => a.student_id === studentId).map((a) => a.mentor_id)

  const rows = projects
    .map((p) => {
      const mentorIds = mentorIdsFor(p.student_id)
      const last = lastUpdate.get(p.id) ?? null
      return {
        project: p,
        student: nameOf(p.student_id),
        cohort: cohorts.find((c) => c.id === p.cohort_id)?.name ?? '—',
        mentorIds,
        mentors: mentorIds.map(nameOf).join(', '),
        last,
        health: projectHealth(p.current_stage, last),
      }
    })
    .sort((a, b) => a.project.name.localeCompare(b.project.name))

  const counts = {
    total: rows.length,
    active: rows.filter((r) => r.health === 'active').length,
    building: rows.filter((r) => r.project.current_stage === 'building').length,
    launch: rows.filter((r) => r.project.current_stage === 'launch').length,
  }

  const q = query.trim().toLowerCase()
  const visible = rows.filter((r) => {
    if (cohortFilter !== 'all' && r.project.cohort_id !== cohortFilter) return false
    if (mentorFilter !== 'all' && !r.mentorIds.includes(mentorFilter)) return false
    if (stageFilter !== 'all' && r.project.current_stage !== stageFilter) return false
    if (q && !r.project.name.toLowerCase().includes(q) && !r.student.toLowerCase().includes(q)) return false
    return true
  })

  const mentorOptions = users
    .filter((u) => u.role === 'mentor' && assignments.some((a) => a.mentor_id === u.id))
    .map((u) => ({ value: u.id, label: u.full_name }))

  function resetFilters() {
    setQuery('')
    setCohortFilter('all')
    setMentorFilter('all')
    setStageFilter('all')
  }

  function exportCsv() {
    const header = ['Project', 'Student', 'Cohort', 'Mentor', 'Stage', 'Last progress update', 'Status']
    const lines = visible.map((r) =>
      [
        r.project.name,
        r.student,
        r.cohort,
        r.mentors,
        stageLabels[r.project.current_stage],
        r.last ? new Date(r.last).toISOString().slice(0, 10) : '',
        r.health,
      ]
        .map(csvCell)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `projects-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Administrator"
        title="Projects"
        description="Monitor every student project across all cohorts, stages, and mentors."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-lg" onClick={resetFilters}>
              <SlidersHorizontal className="size-4" /> Reset Filters
            </Button>
            {!loading && !loadError && (
              <CreateProjectDialog
                users={users}
                projects={projects}
                onCreated={(p) => setProjects((prev) => [p, ...prev])}
              />
            )}
            <Button className="rounded-lg px-3" onClick={exportCsv} disabled={loading || visible.length === 0}>
              <Download className="size-4" /> Export Projects
            </Button>
          </div>
        }
      />

      {loading && <PageLoading />}
      {!loading && loadError && <PageError>{loadError}</PageError>}

      {!loading && !loadError && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={FolderKanban} label="Total Projects" value={counts.total} hint="All cohorts" />
            <StatCard
              icon={Activity}
              label="Active Projects"
              value={counts.active}
              hint="Progress update in the last 7 days"
            />
            <StatCard icon={Hammer} label="Building Stage" value={counts.building} hint="Building first version" />
            <StatCard icon={Rocket} label="Launch Stage" value={counts.launch} hint="Preparing to ship" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search by project or student name…" />
            <SelectFilter
              label="Cohort"
              value={cohortFilter}
              onChange={setCohortFilter}
              options={cohorts.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectFilter label="Mentor" value={mentorFilter} onChange={setMentorFilter} options={mentorOptions} />
            <SelectFilter
              label="Stage"
              value={stageFilter}
              onChange={setStageFilter}
              options={stageOrder.map((s) => ({ value: s, label: stageLabels[s] }))}
            />
          </div>

          <DataTable
            head={[
              { label: 'Project Name' },
              { label: 'Student' },
              { label: 'Cohort' },
              { label: 'Mentor' },
              { label: 'Current Stage' },
              { label: 'Last Progress Update' },
              { label: 'Status' },
              { label: 'Action', align: 'right' },
            ]}
          >
            {visible.map((r) => (
              <Tr key={r.project.id}>
                <Td strong>{r.project.name}</Td>
                <Td muted>{r.student}</Td>
                <Td muted>{r.cohort}</Td>
                <Td muted>
                  <div className="max-w-[220px] truncate" title={r.mentors}>
                    {r.mentors || 'Unassigned'}
                  </div>
                </Td>
                <Td>
                  <Tag tone={stageTone[r.project.current_stage]}>
                    {stageLabels[r.project.current_stage]}
                  </Tag>
                </Td>
                <Td muted className="whitespace-nowrap">
                  {r.last ? formatDate(r.last) : 'No updates yet'}
                </Td>
                <Td>
                  <Tag tone={projectHealthTone[r.health]} className="capitalize">
                    {r.health}
                  </Tag>
                </Td>
                <Td align="right">
                  <RowLink to={`/admin/projects/${r.project.id}`}>View Project</RowLink>
                </Td>
              </Tr>
            ))}
            {visible.length === 0 && (
              <EmptyRow colSpan={8}>
                {projects.length === 0 ? 'No projects yet.' : 'No projects match your filters.'}
              </EmptyRow>
            )}
          </DataTable>
          <p className="text-xs text-muted-foreground">
            Status is based on the latest progress update: active within 7 days, at risk within 14,
            stalled after that. Launch-stage projects show as completed. Change a project's stage from
            its detail page.
          </p>
        </>
      )}
    </Page>
  )
}
