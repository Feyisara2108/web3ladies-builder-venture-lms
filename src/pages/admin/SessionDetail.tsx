import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardCheck,
  Edit3,
  ExternalLink,
  LinkIcon,
  Loader2,
  PlayCircle,
  Target,
  XCircle,
} from 'lucide-react'
import { Page } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { BackLink, NotFoundState, PageError, PageLoading } from '@/components/PageState'
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
import { listAttendanceForSession, listCohorts, listUsers } from '@/data/queries'
import { getSession, updateSessionAdmin } from '@/data/queries-admin'
import { stageLabels } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { AttendanceRecord, Cohort, Session, User } from '@/types'
import {
  attendanceRate,
  formatRate,
  formatSessionDate,
  formatSessionTime,
  sessionLocationLabel,
  sessionStatusLabel,
  sessionStatusTone,
  sessionTypeLabel,
  stageTone,
} from './helpers'
import { SessionDialog } from './SessionDialog'

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <Panel className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="size-4" /> {title}
      </h2>
      {children}
    </Panel>
  )
}

function CancelSessionDialog({ session, onCancelled }: { session: Session; onCancelled: (s: Session) => void }) {
  const { showToast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleCancel() {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateSessionAdmin(session.id, { status: 'cancelled' })
      onCancelled(updated)
      setOpen(false)
      showToast('Session cancelled')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to cancel session'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-lg" disabled={session.status === 'cancelled'}>
          <XCircle className="size-4" /> Cancel Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {session.title}?</DialogTitle>
          <DialogDescription>
            The session stays on record but is marked as cancelled. You can reschedule it later by
            editing its status.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Keep session
          </Button>
          <Button variant="destructive" size="sm" onClick={handleCancel} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Cancel session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminSessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = React.useState<Session | null>(null)
  const [cohorts, setCohorts] = React.useState<Cohort[]>([])
  const [users, setUsers] = React.useState<User[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [notFound, setNotFound] = React.useState(false)

  React.useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    setLoading(true)
    Promise.all([getSession(sessionId), listCohorts(), listUsers(), listAttendanceForSession(sessionId)])
      .then(([sessionData, cohortData, userData, attendanceData]) => {
        if (cancelled) return
        setSession(sessionData)
        setCohorts(cohortData)
        setUsers(userData)
        setAttendance(attendanceData)
      })
      .catch((err) => {
        if (cancelled) return
        if (typeof err === 'object' && err && 'code' in err && err.code === 'PGRST116') setNotFound(true)
        else setLoadError(getErrorMessage(err, 'Failed to load session'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const facilitators = React.useMemo(
    () => users.filter((u) => u.role === 'mentor' || u.role === 'admin'),
    [users],
  )

  if (loading) return <PageLoading className="min-h-[60vh]" />

  if (notFound || !session) {
    if (loadError) {
      return (
        <Page>
          <BackLink to="/admin/sessions">Back to Sessions</BackLink>
          <PageError>{loadError}</PageError>
        </Page>
      )
    }
    return (
      <NotFoundState
        icon={CalendarDays}
        title="Session not found"
        description="This session does not exist or has been removed."
        backTo="/admin/sessions"
        backLabel="Back to Sessions"
      />
    )
  }

  const cohort = cohorts.find((c) => c.id === session.cohort_id)
  const facilitator = users.find((u) => u.id === session.facilitator_id)
  const objectives = (session.learning_objectives ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
  const counts = {
    present: attendance.filter((a) => a.status === 'present').length,
    absent: attendance.filter((a) => a.status === 'absent').length,
    excused: attendance.filter((a) => a.status === 'excused').length,
  }

  return (
    <Page>
      <BackLink to="/admin/sessions">Back to Sessions</BackLink>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Session</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{session.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cohort ? (
              <Link to={`/admin/cohorts/${cohort.id}`} className="hover:underline">
                {cohort.name}
              </Link>
            ) : (
              'Unknown cohort'
            )}{' '}
            · {formatSessionDate(session.start_time)} · {formatSessionTime(session.start_time, session.end_time)} ·{' '}
            {facilitator?.full_name ?? 'Unassigned'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag tone={sessionStatusTone[session.status]}>{sessionStatusLabel[session.status]}</Tag>
            <Tag>{sessionTypeLabel[session.type]}</Tag>
            <Tag>{sessionLocationLabel[session.location]}</Tag>
            {session.stage && <Tag tone={stageTone[session.stage]}>{stageLabels[session.stage]}</Tag>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SessionDialog
            session={session}
            cohorts={cohorts}
            facilitators={facilitators}
            onSaved={setSession}
            trigger={
              <Button variant="outline" className="rounded-lg">
                <Edit3 className="size-4" /> Edit Session
              </Button>
            }
          />
          <CancelSessionDialog session={session} onCancelled={setSession} />
        </div>
      </div>

      <Section icon={CalendarDays} title="Description">
        <p className="mt-2 text-sm text-muted-foreground">
          {session.description || 'No description provided.'}
        </p>
        {session.link && session.location !== 'in-person' && (
          <a
            href={session.link}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Meeting link <ExternalLink className="size-3.5" />
          </a>
        )}
      </Section>

      <Section icon={Target} title="Learning Objectives">
        {objectives.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No objectives provided.</p>
        )}
      </Section>

      <Section icon={LinkIcon} title="Resources">
        {session.resources_url ? (
          <a
            href={session.resources_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Session notes <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No resources attached.</p>
        )}
      </Section>

      <Section icon={PlayCircle} title="Recording">
        {session.recording_url ? (
          <a
            href={session.recording_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Watch recording <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Recording not available yet.</p>
        )}
      </Section>

      <Section icon={ClipboardCheck} title="Attendance">
        {attendance.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No attendance submitted yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Attendance rate</div>
              <div className="text-lg font-semibold">{formatRate(attendanceRate(attendance))}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Present</div>
              <div className="text-lg font-semibold">{counts.present}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Absent</div>
              <div className="text-lg font-semibold">{counts.absent}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Excused</div>
              <div className="text-lg font-semibold">{counts.excused}</div>
            </div>
          </div>
        )}
      </Section>
    </Page>
  )
}
