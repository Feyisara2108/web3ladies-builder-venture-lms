import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { createSessionAdmin, updateSessionAdmin } from '@/data/queries-admin'
import { nowForDateTimeInput, stageLabels, toDateTimeInput } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Cohort, ProjectStage, Session, SessionStatus, User } from '@/types'

type SessionForm = {
  title: string
  cohort_id: string
  type: Session['type']
  stage: ProjectStage | 'none'
  start_time: string
  end_time: string
  facilitator_id: string
  location: Session['location']
  link: string
  description: string
  learning_objectives: string
  resources_url: string
  recording_url: string
  status: SessionStatus
}

function emptyForm(defaultCohortId: string, defaultFacilitatorId: string): SessionForm {
  return {
    title: '',
    cohort_id: defaultCohortId,
    type: 'live-class',
    stage: 'none',
    start_time: '',
    end_time: '',
    facilitator_id: defaultFacilitatorId,
    location: 'discord',
    link: '',
    description: '',
    learning_objectives: '',
    resources_url: '',
    recording_url: '',
    status: 'scheduled',
  }
}

function formFromSession(session: Session): SessionForm {
  return {
    title: session.title,
    cohort_id: session.cohort_id,
    type: session.type,
    stage: session.stage ?? 'none',
    start_time: toDateTimeInput(session.start_time),
    end_time: toDateTimeInput(session.end_time),
    facilitator_id: session.facilitator_id ?? '',
    location: session.location,
    link: session.link ?? '',
    description: session.description ?? '',
    learning_objectives: session.learning_objectives ?? '',
    resources_url: session.resources_url ?? '',
    recording_url: session.recording_url ?? '',
    status: session.status,
  }
}

/**
 * Create / edit a session. Pass `session` to edit. Pass `fixedCohortId` to
 * schedule into one cohort without showing the cohort picker. The dialog
 * can be controlled (`open` + `onOpenChange`) or render its own `trigger`.
 */
export function SessionDialog({
  session,
  cohorts,
  facilitators,
  onSaved,
  fixedCohortId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  session?: Session
  cohorts: Cohort[]
  facilitators: User[]
  onSaved: (s: Session) => void
  fixedCohortId?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = !!session
  const { showToast } = useToast()
  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState

  const defaultCohort = fixedCohortId ?? cohorts[0]?.id ?? ''
  const defaultFacilitator = facilitators[0]?.id ?? ''
  const [form, setForm] = React.useState<SessionForm>(() =>
    session ? formFromSession(session) : emptyForm(defaultCohort, defaultFacilitator),
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Never let someone pick a NEW past date — but if we're editing a
  // session whose start time is already in the past, allow it to stay
  // there (or move later) rather than fighting the browser's native
  // min-date validation on an already-valid existing value.
  const minStart =
    session && new Date(session.start_time).getTime() < Date.now()
      ? toDateTimeInput(session.start_time)
      : nowForDateTimeInput()

  React.useEffect(() => {
    if (open) {
      setForm(session ? formFromSession(session) : emptyForm(defaultCohort, defaultFacilitator))
      setError(null)
    }
  }, [open, session, defaultCohort, defaultFacilitator])

  function set<K extends keyof SessionForm>(key: K, value: SessionForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.cohort_id || !form.start_time || !form.end_time || !form.facilitator_id) {
      setError('Title, cohort, start, end, and facilitator are all required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        cohort_id: form.cohort_id,
        title: form.title,
        type: form.type,
        stage: form.stage === 'none' ? null : form.stage,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        facilitator_id: form.facilitator_id,
        location: form.location,
        link: form.location === 'in-person' ? null : form.link.trim() || null,
        description: form.description || null,
        learning_objectives: form.learning_objectives || null,
        resources_url: form.resources_url.trim() || null,
        recording_url: form.recording_url.trim() || null,
      }
      const saved = isEdit
        ? await updateSessionAdmin(session.id, { ...payload, status: form.status })
        : await createSessionAdmin(payload)
      onSaved(saved)
      setOpen(false)
      showToast(isEdit ? 'Session updated' : 'Session created')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save session'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit session' : 'Schedule session'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this session.' : "Add a new session to a cohort's calendar."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="session-title">Title</Label>
            <Input id="session-title" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!fixedCohortId && (
              <div className="flex flex-col gap-2">
                <Label>Cohort</Label>
                {cohorts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Create a cohort first.</p>
                ) : (
                  <Select value={form.cohort_id} onValueChange={(v) => set('cohort_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v as Session['type'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live-class">Live class</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="office-hours">Office hours</SelectItem>
                  <SelectItem value="demo-day">Demo day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Curriculum stage (optional)</Label>
              <Select value={form.stage} onValueChange={(v) => set('stage', v as ProjectStage | 'none')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {Object.entries(stageLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v as SessionStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start-time">Start</Label>
              <Input
                id="start-time"
                type="datetime-local"
                min={minStart}
                value={form.start_time}
                onChange={(e) => set('start_time', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end-time">End</Label>
              <Input
                id="end-time"
                type="datetime-local"
                min={form.start_time || minStart}
                value={form.end_time}
                onChange={(e) => set('end_time', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Facilitator</Label>
              <Select value={form.facilitator_id} onValueChange={(v) => set('facilitator_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a facilitator" />
                </SelectTrigger>
                <SelectContent>
                  {facilitators.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Location</Label>
              <Select value={form.location} onValueChange={(v) => set('location', v as Session['location'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="google-meet">Google Meet</SelectItem>
                  <SelectItem value="in-person">In person</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.location !== 'in-person' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="session-link">Meeting link</Label>
              <Input
                id="session-link"
                type="url"
                placeholder="https://meet.google.com/..."
                value={form.link}
                onChange={(e) => set('link', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Students get a Join button with this link.</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="learning-objectives">Learning objectives</Label>
            <Textarea
              id="learning-objectives"
              rows={3}
              value={form.learning_objectives}
              onChange={(e) => set('learning_objectives', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">One objective per line.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="resources-url">Notes link (optional)</Label>
              <Input
                id="resources-url"
                type="url"
                placeholder="https://notion.so/..."
                value={form.resources_url}
                onChange={(e) => set('resources_url', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="recording-url">Recording link (optional)</Label>
              <Input
                id="recording-url"
                type="url"
                placeholder="https://youtube.com/..."
                value={form.recording_url}
                onChange={(e) => set('recording_url', e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Schedule session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
