import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  FolderKanban,
  LineChart,
  Link2,
  Loader2,
  Pencil,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Page } from '@/components/PageHeader'
import { Panel, PanelHeader } from '@/components/Panel'
import { StatCard } from '@/components/StatCard'
import { DataTable, EmptyRow, Td, Tr } from '@/components/DataTable'
import { BackLink, NotFoundState, PageError, PageLoading } from '@/components/PageState'
import { Tag } from '@/components/Tag'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  assignMentorToStudents,
  createInviteLink,
  deleteCohort,
  getActiveInviteLink,
  getCohort,
  listAttendanceForStudents,
  listMentorAssignments,
  listMentorsByCohort,
  listProgressUpdatesForStudents,
  listProjects,
  listSessions,
  listStudentsByCohort,
  listUsers,
  revokeInviteLink,
  unassignMentorFromStudent,
  updateCohort,
} from '@/data/queries'
import { formatDate, stageLabels, todayForDateInput } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type {
  AttendanceRecord,
  Cohort,
  CohortStatus,
  MentorAssignment,
  Project,
  ProgressUpdate,
  Session,
  User,
} from '@/types'
import { attendanceRate, cohortStatusTone, formatRate, formatSessionDate, initials, stageTone } from './helpers'
import { SessionDialog } from './SessionDialog'

function EditCohortDialog({ cohort, onSaved }: { cohort: Cohort; onSaved: (c: Cohort) => void }) {
  const { showToast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    name: cohort.name,
    programme: cohort.programme ?? '',
    start_date: cohort.start_date,
    end_date: cohort.end_date,
    status: cohort.status,
    discord_invite_url: cohort.discord_invite_url ?? '',
    notion_url: cohort.notion_url ?? '',
  })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Block picking a NEW past start date, but don't fight the browser's
  // native min-date validation on a cohort whose start date is already
  // in the past.
  const minStart = cohort.start_date < todayForDateInput() ? cohort.start_date : todayForDateInput()

  React.useEffect(() => {
    if (open) {
      setForm({
        name: cohort.name,
        programme: cohort.programme ?? '',
        start_date: cohort.start_date,
        end_date: cohort.end_date,
        status: cohort.status,
        discord_invite_url: cohort.discord_invite_url ?? '',
        notion_url: cohort.notion_url ?? '',
      })
      setError(null)
    }
  }, [open, cohort])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateCohort(cohort.id, {
        name: form.name,
        programme: form.programme || null,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        discord_invite_url: form.discord_invite_url || null,
        notion_url: form.notion_url || null,
      })
      onSaved(updated)
      setOpen(false)
      showToast('Cohort updated')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save cohort'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-lg px-3">
          <Pencil className="size-4" /> Edit Cohort
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit cohort</DialogTitle>
          <DialogDescription>Update details for {cohort.name}.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-programme">Programme</Label>
            <Input
              id="edit-programme"
              value={form.programme}
              onChange={(e) => setForm((f) => ({ ...f, programme: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-start">Start date</Label>
              <Input
                id="edit-start"
                type="date"
                min={minStart}
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-end">End date</Label>
              <Input
                id="edit-end"
                type="date"
                min={form.start_date || minStart}
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as CohortStatus }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-discord">Discord invite link</Label>
            <Input
              id="edit-discord"
              value={form.discord_invite_url}
              onChange={(e) => setForm((f) => ({ ...f, discord_invite_url: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-notion">Notion curriculum link</Label>
            <Input
              id="edit-notion"
              value={form.notion_url}
              onChange={(e) => setForm((f) => ({ ...f, notion_url: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssignMentorDialog({
  mentors,
  students,
  assignments,
  onAssignmentsChanged,
}: {
  mentors: User[]
  students: User[]
  assignments: MentorAssignment[]
  onAssignmentsChanged: (next: MentorAssignment[]) => void
}) {
  const { user: currentAdmin } = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [mentorId, setMentorId] = React.useState('')
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setMentorId(mentors[0]?.id ?? '')
      setError(null)
    }
  }, [open, mentors])

  const currentAssignments = assignments.filter((a) => a.mentor_id === mentorId)
  const assignedStudentIds = new Set(currentAssignments.map((a) => a.student_id))

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  async function handleAssign() {
    if (!mentorId || selectedStudentIds.size === 0) return
    setBusy(true)
    setError(null)
    try {
      const ids = Array.from(selectedStudentIds)
      await assignMentorToStudents(mentorId, ids, currentAdmin.id)
      const newRows: MentorAssignment[] = ids.map((studentId) => ({
        id: `${mentorId}-${studentId}`,
        mentor_id: mentorId,
        student_id: studentId,
        assigned_by: currentAdmin.id,
        created_at: new Date().toISOString(),
      }))
      onAssignmentsChanged([
        ...assignments.filter(
          (a) => !(a.mentor_id === mentorId && selectedStudentIds.has(a.student_id)),
        ),
        ...newRows,
      ])
      setSelectedStudentIds(new Set())
      showToast(`Assigned ${ids.length} student${ids.length === 1 ? '' : 's'}`)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to assign mentor'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(studentId: string) {
    setBusy(true)
    setError(null)
    try {
      await unassignMentorFromStudent(mentorId, studentId)
      onAssignmentsChanged(
        assignments.filter((a) => !(a.mentor_id === mentorId && a.student_id === studentId)),
      )
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove assignment'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-lg">
          <UserPlus className="size-4" /> Assign Mentor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign mentor to students</DialogTitle>
          <DialogDescription>
            Pick a mentor from this cohort, then choose which students they're responsible for.
          </DialogDescription>
        </DialogHeader>
        {mentors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mentors are assigned to this cohort yet. Set a mentor's cohort on the Users page
            first, then come back here to assign them to specific students.
          </p>
        ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Mentor</Label>
            <Select value={mentorId} onValueChange={setMentorId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mentors.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentAssignments.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Currently assigned</Label>
              <div className="flex flex-wrap gap-2">
                {currentAssignments.map((a) => {
                  const student = students.find((s) => s.id === a.student_id)
                  return (
                    <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                      {student?.full_name ?? 'Unknown'}
                      <button
                        type="button"
                        onClick={() => handleRemove(a.student_id)}
                        disabled={busy}
                        className="rounded-full p-0.5 hover:bg-background/60"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Add students</Label>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-2">
              {students
                .filter((s) => !assignedStudentIds.has(s.id))
                .map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selectedStudentIds.has(student.id)}
                      onChange={() => toggleStudent(student.id)}
                    />
                    {student.full_name}
                  </label>
                ))}
              {students.filter((s) => !assignedStudentIds.has(s.id)).length === 0 && (
                <p className="px-1 py-1.5 text-sm text-muted-foreground">
                  Every student is already assigned to this mentor.
                </p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button onClick={handleAssign} disabled={busy || selectedStudentIds.size === 0}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Assign selected
            </Button>
          </DialogFooter>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InviteLinkDialog({ cohort }: { cohort: Cohort }) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [link, setLink] = React.useState<Awaited<ReturnType<typeof getActiveInviteLink>>>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getActiveInviteLink(cohort.id)
      .then((data) => {
        if (!cancelled) setLink(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load invite link'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, cohort.id])

  async function handleGenerate() {
    setBusy(true)
    setError(null)
    try {
      const created = await createInviteLink(cohort.id, user.id)
      setLink(created)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate link'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke() {
    if (!link) return
    setBusy(true)
    setError(null)
    try {
      await revokeInviteLink(link.id)
      setLink(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to revoke link'))
    } finally {
      setBusy(false)
    }
  }

  const url = link ? `${window.location.origin}/join/${link.token}` : ''

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the link and copy it manually.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-lg">
          <Link2 className="size-4" /> Invite Link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join link for {cohort.name}</DialogTitle>
          <DialogDescription>
            Anyone with this link can create their own student account, auto-enrolled in this
            cohort. Expires 30 days after it's generated.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !link && (
          <Button onClick={handleGenerate} disabled={busy} className="w-fit">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Generate link
          </Button>
        )}

        {!loading && link && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input value={url} readOnly className="text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span className="sr-only">Copy link</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {formatDate(link.expires_at)} · used {link.use_count} time
              {link.use_count === 1 ? '' : 's'}
            </p>
            <DialogFooter>
              <Button type="button" variant="destructive" size="sm" onClick={handleRevoke} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Revoke link
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeleteCohortDialog({ cohort }: { cohort: Cohort }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await deleteCohort(cohort.id)
      showToast('Cohort deleted')
      navigate('/admin/cohorts', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete cohort'))
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-lg text-destructive hover:text-destructive">
          <Trash2 className="size-4" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {cohort.name}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the cohort along with its sessions, projects, and any active
            invite link. Students and mentors assigned to it are not deleted — they'll just be
            unassigned from a cohort. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Delete cohort
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminCohortDetail() {
  const { cohortId } = useParams<{ cohortId: string }>()

  const [cohort, setCohort] = React.useState<Cohort | null>(null)
  const [students, setStudents] = React.useState<User[]>([])
  const [mentors, setMentors] = React.useState<User[]>([])
  const [allUsers, setAllUsers] = React.useState<User[]>([])
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [progressUpdates, setProgressUpdates] = React.useState<ProgressUpdate[]>([])
  const [assignments, setAssignments] = React.useState<MentorAssignment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [notFound, setNotFound] = React.useState(false)
  const [addSessionOpen, setAddSessionOpen] = React.useState(false)

  React.useEffect(() => {
    if (!cohortId) {
      setLoading(false)
      return
    }
    let cancelled = false
    getCohort(cohortId)
      .then(async (cohortData) => {
        const [studentData, mentorData, sessionData, projectData, userData] = await Promise.all([
          listStudentsByCohort(cohortId),
          listMentorsByCohort(cohortId),
          listSessions(),
          listProjects(),
          listUsers(),
        ])
        const studentIds = studentData.map((s) => s.id)
        const [attendanceData, updateData, assignmentData] = await Promise.all([
          listAttendanceForStudents(studentIds),
          listProgressUpdatesForStudents(studentIds),
          listMentorAssignments({ studentIds }),
        ])
        if (cancelled) return
        setCohort(cohortData)
        setStudents(studentData)
        setMentors(mentorData)
        setAllUsers(userData)
        setSessions(sessionData.filter((s) => s.cohort_id === cohortId))
        setProjects(projectData.filter((p) => p.cohort_id === cohortId))
        setAttendance(attendanceData)
        setProgressUpdates(updateData)
        setAssignments(assignmentData)
      })
      .catch((err) => {
        if (cancelled) return
        if (typeof err === 'object' && err && 'code' in err && err.code === 'PGRST116') setNotFound(true)
        else setLoadError(getErrorMessage(err, 'Failed to load cohort'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cohortId])

  const facilitators = React.useMemo(
    () => allUsers.filter((u) => u.role === 'mentor' || u.role === 'admin'),
    [allUsers],
  )

  if (loading) return <PageLoading className="min-h-[60vh]" />

  if (notFound || !cohort) {
    if (loadError) {
      return (
        <Page>
          <BackLink to="/admin/cohorts">Back to Cohorts</BackLink>
          <PageError>{loadError}</PageError>
        </Page>
      )
    }
    return (
      <NotFoundState
        icon={FolderKanban}
        title="Cohort not found"
        description={
          <>
            We couldn't find a cohort with the id <span className="font-mono">{cohortId}</span>.
          </>
        }
        backTo="/admin/cohorts"
        backLabel="Back to Cohorts"
      />
    )
  }

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )
  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name ?? '—'

  return (
    <Page>
      <BackLink to="/admin/cohorts">Back to Cohorts</BackLink>

      {/* Overview */}
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {cohort.programme && (
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{cohort.programme}</p>
            )}
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{cohort.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-4" />
                {formatDate(cohort.start_date)} — {formatDate(cohort.end_date)}
              </span>
              <Tag tone={cohortStatusTone[cohort.status]} className="capitalize">
                {cohort.status}
              </Tag>
              {cohort.discord_invite_url && (
                <a
                  href={cohort.discord_invite_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Discord →
                </a>
              )}
              {cohort.notion_url && (
                <a href={cohort.notion_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Notion →
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AssignMentorDialog
              mentors={mentors}
              students={students}
              assignments={assignments}
              onAssignmentsChanged={setAssignments}
            />
            <Button variant="outline" className="rounded-lg" onClick={() => setAddSessionOpen(true)}>
              <CalendarPlus className="size-4" /> Add Session
            </Button>
            <InviteLinkDialog cohort={cohort} />
            <DeleteCohortDialog cohort={cohort} />
            <EditCohortDialog cohort={cohort} onSaved={setCohort} />
          </div>
        </div>
      </Panel>

      <SessionDialog
        open={addSessionOpen}
        onOpenChange={setAddSessionOpen}
        fixedCohortId={cohort.id}
        cohorts={[cohort]}
        facilitators={facilitators}
        onSaved={(s) => setSessions((prev) => [...prev, s])}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="Students" value={students.length} />
        <StatCard icon={UserRound} label="Mentors" value={mentors.length} />
        <StatCard icon={CalendarDays} label="Sessions" value={sessions.length} />
        <StatCard icon={BarChart3} label="Attendance Rate" value={formatRate(attendanceRate(attendance))} />
        <StatCard icon={LineChart} label="Progress Updates" value={progressUpdates.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            icon={Users}
            title="Students"
            action={<span className="text-xs text-muted-foreground">{students.length} total</span>}
          />
          <DataTable
            framed={false}
            compact
            head={[{ label: 'Name' }, { label: 'Project' }, { label: 'Stage' }, { label: 'Attendance' }]}
          >
            {students.map((student) => {
              const project = projects.find((p) => p.student_id === student.id)
              return (
                <Tr key={student.id}>
                  <Td compact strong>
                    <Link to={`/admin/users/${student.id}`} className="hover:underline">
                      {student.full_name}
                    </Link>
                  </Td>
                  <Td compact muted>
                    {project?.name ?? '—'}
                  </Td>
                  <Td compact muted>
                    {project ? (
                      <Tag tone={stageTone[project.current_stage]}>{stageLabels[project.current_stage]}</Tag>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td compact muted>
                    {formatRate(attendanceRate(attendance, (r) => r.student_id === student.id))}
                  </Td>
                </Tr>
              )
            })}
            {students.length === 0 && <EmptyRow colSpan={4}>No students in this cohort yet.</EmptyRow>}
          </DataTable>
        </Panel>

        <Panel>
          <PanelHeader
            icon={UserRound}
            title="Mentors"
            action={<span className="text-xs text-muted-foreground">{mentors.length} total</span>}
          />
          <DataTable framed={false} compact head={[{ label: 'Mentor Name' }, { label: 'Assigned Students' }]}>
            {mentors.map((mentor) => (
              <Tr key={mentor.id}>
                <Td compact strong>
                  <Link to={`/admin/users/${mentor.id}`} className="flex items-center gap-2 hover:underline">
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {initials(mentor.full_name)}
                    </span>
                    {mentor.full_name}
                  </Link>
                </Td>
                <Td compact muted>
                  {assignments.filter((a) => a.mentor_id === mentor.id).length}
                </Td>
              </Tr>
            ))}
            {mentors.length === 0 && <EmptyRow colSpan={2}>No mentors in this cohort yet.</EmptyRow>}
          </DataTable>
        </Panel>

        <Panel>
          <PanelHeader
            icon={CalendarDays}
            title="Sessions"
            action={<span className="text-xs text-muted-foreground">{sessions.length} total</span>}
          />
          <DataTable framed={false} compact head={[{ label: 'Session Title' }, { label: 'Date' }, { label: 'Attendance' }]}>
            {sortedSessions.map((session) => (
              <Tr key={session.id}>
                <Td compact strong>
                  <Link to={`/admin/sessions/${session.id}`} className="hover:underline">
                    {session.title}
                  </Link>
                </Td>
                <Td compact muted className="whitespace-nowrap">
                  {formatSessionDate(session.start_time)}
                </Td>
                <Td compact muted>
                  {formatRate(attendanceRate(attendance, (r) => r.session_id === session.id))}
                </Td>
              </Tr>
            ))}
            {sessions.length === 0 && <EmptyRow colSpan={3}>No sessions scheduled yet.</EmptyRow>}
          </DataTable>
        </Panel>

        <Panel>
          <PanelHeader
            icon={FolderKanban}
            title="Projects"
            action={<span className="text-xs text-muted-foreground">{projects.length} total</span>}
          />
          <DataTable framed={false} compact head={[{ label: 'Student' }, { label: 'Project' }, { label: 'Current Stage' }]}>
            {projects.map((project) => (
              <Tr key={project.id}>
                <Td compact strong>
                  {studentName(project.student_id)}
                </Td>
                <Td compact muted>
                  <Link to={`/admin/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                </Td>
                <Td compact>
                  <Tag tone={stageTone[project.current_stage]}>{stageLabels[project.current_stage]}</Tag>
                </Td>
              </Tr>
            ))}
            {projects.length === 0 && <EmptyRow colSpan={3}>No projects yet.</EmptyRow>}
          </DataTable>
        </Panel>
      </div>
    </Page>
  )
}
