import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { FolderKanban, Mail, ShieldCheck, UserCog, UserRound, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Page } from '@/components/PageHeader'
import { EmptyState, Panel, PanelHeader, PanelItem, PanelLink } from '@/components/Panel'
import { BackLink, InfoTile, NotFoundState, PageError, PageLoading } from '@/components/PageState'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import {
  getProjectByStudentId,
  getUser,
  listAttendanceForStudents,
  listCohorts,
  listMentorAssignments,
  listProgressUpdatesByStudent,
  listUsers,
} from '@/data/queries'
import { formatDate, stageLabels } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import type { AttendanceRecord, Cohort, MentorAssignment, Project, ProgressUpdate, User } from '@/types'
import {
  attendanceRate,
  formatRate,
  getUserStatus,
  relativeTime,
  roleTone,
  stageTone,
  userStatusTone,
} from './helpers'
import { DeactivateButton, EditUserDialog } from './UserDialogs'

interface StudentExtras {
  project: Project | null
  attendance: AttendanceRecord[]
  updates: ProgressUpdate[]
}

export function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const { user: currentUser } = useAuth()

  const [user, setUser] = React.useState<User | null>(null)
  const [users, setUsers] = React.useState<User[]>([])
  const [cohorts, setCohorts] = React.useState<Cohort[]>([])
  const [assignments, setAssignments] = React.useState<MentorAssignment[]>([])
  const [student, setStudent] = React.useState<StudentExtras | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [notFound, setNotFound] = React.useState(false)

  React.useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    getUser(userId)
      .then(async (userData) => {
        const [userList, cohortData, assignmentData] = await Promise.all([
          listUsers(),
          listCohorts(),
          userData.role === 'mentor'
            ? listMentorAssignments({ mentorId: userData.id })
            : userData.role === 'student'
              ? listMentorAssignments({ studentIds: [userData.id] })
              : Promise.resolve([]),
        ])
        let extras: StudentExtras | null = null
        if (userData.role === 'student') {
          const [project, attendance, updates] = await Promise.all([
            getProjectByStudentId(userData.id),
            listAttendanceForStudents([userData.id]),
            listProgressUpdatesByStudent(userData.id),
          ])
          extras = { project, attendance, updates }
        }
        if (cancelled) return
        setUser(userData)
        setUsers(userList)
        setCohorts(cohortData)
        setAssignments(assignmentData)
        setStudent(extras)
      })
      .catch((err) => {
        if (cancelled) return
        // PostgREST "no rows" for .single()
        if (typeof err === 'object' && err && 'code' in err && err.code === 'PGRST116') setNotFound(true)
        else setLoadError(getErrorMessage(err, 'Failed to load user'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) return <PageLoading className="min-h-[60vh]" />

  if (notFound || !user) {
    if (loadError) {
      return (
        <Page>
          <BackLink to="/admin/users">Back to Users</BackLink>
          <PageError>{loadError}</PageError>
        </Page>
      )
    }
    return (
      <NotFoundState
        icon={UserRound}
        title="User not found"
        description="This user does not exist or has been removed."
        backTo="/admin/users"
        backLabel="Back to Users"
      />
    )
  }

  const status = getUserStatus(user)
  const cohort = cohorts.find((c) => c.id === user.cohort_id)
  const nameOf = (id: string) => users.find((u) => u.id === id)?.full_name ?? 'Unknown user'
  const isSelf = user.id === currentUser.id

  const linkedPeople =
    user.role === 'mentor'
      ? assignments.map((a) => a.student_id)
      : user.role === 'student'
        ? assignments.map((a) => a.mentor_id)
        : []

  return (
    <Page>
      <BackLink to="/admin/users">Back to Users</BackLink>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">User Profile</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{user.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isSelf && (
            <EditUserDialog
              user={user}
              cohorts={cohorts}
              onSaved={setUser}
              trigger={
                <Button variant="outline" className="rounded-lg">
                  <UserCog className="size-4" /> Assign Role
                </Button>
              }
            />
          )}
          <Button variant="outline" className="rounded-lg" asChild>
            <a href={`mailto:${user.email}`}>
              <Mail className="size-4" /> Send Message
            </a>
          </Button>
          {!isSelf && <DeactivateButton user={user} onChanged={setUser} variant="full" />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile
          label="Role"
          value={
            <Tag tone={roleTone[user.role]} className="capitalize">
              {user.role}
            </Tag>
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
        <InfoTile
          label="Status"
          value={
            <Tag tone={userStatusTone[status]} className="capitalize">
              {status}
            </Tag>
          }
        />
        <InfoTile label="Joined" value={formatDate(user.created_at)} />
      </div>

      <Panel className="p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-4" /> Account Overview
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {user.full_name} joined the programme as {user.role === 'admin' ? 'an' : 'a'} {user.role} on{' '}
          {formatDate(user.created_at)}.{' '}
          {user.role !== 'admin' && <>Assigned cohort: {cohort?.name ?? 'none yet'}. </>}
          {status === 'pending' && 'They have not accepted their invite yet. '}
          {status === 'inactive' && 'This account is deactivated and cannot sign in. '}
          {isSelf
            ? 'This is your own account — another admin must change its role or status.'
            : 'Manage role and cohort assignments using the actions above.'}
        </p>
        {(user.discord_handle || user.timezone || user.bio) && (
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {user.discord_handle && (
              <div>
                <dt className="text-xs text-muted-foreground">Discord</dt>
                <dd className="font-medium">{user.discord_handle}</dd>
              </div>
            )}
            {user.timezone && (
              <div>
                <dt className="text-xs text-muted-foreground">Timezone</dt>
                <dd className="font-medium">{user.timezone}</dd>
              </div>
            )}
            {user.bio && (
              <div className="sm:col-span-3">
                <dt className="text-xs text-muted-foreground">Bio</dt>
                <dd>{user.bio}</dd>
              </div>
            )}
          </dl>
        )}
      </Panel>

      {(user.role === 'student' || user.role === 'mentor') && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {student && (
            <Panel>
              <PanelHeader
                icon={FolderKanban}
                title="Project"
                action={
                  student.project && (
                    <PanelLink to={`/admin/projects/${student.project.id}`}>Open project</PanelLink>
                  )
                }
              />
              {student.project ? (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{student.project.name}</span>
                    <Tag tone={stageTone[student.project.current_stage]}>
                      {stageLabels[student.project.current_stage]}
                    </Tag>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Attendance</div>
                      <div className="font-medium">{formatRate(attendanceRate(student.attendance))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Last progress update</div>
                      <div className="font-medium">
                        {student.updates[0] ? relativeTime(student.updates[0].created_at) : 'None yet'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState>No project yet.</EmptyState>
              )}
            </Panel>
          )}

          <Panel>
            <PanelHeader
              icon={Users}
              title={user.role === 'mentor' ? 'Assigned students' : 'Assigned mentors'}
              action={<span className="text-xs text-muted-foreground">{linkedPeople.length} total</span>}
            />
            {linkedPeople.length === 0 ? (
              <EmptyState>
                {user.role === 'mentor'
                  ? 'No students assigned yet. Assign them from the cohort page.'
                  : 'No mentor assigned yet. Assign one from the cohort page.'}
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {linkedPeople.map((id) => (
                  <PanelItem key={id} className="py-2 text-sm">
                    <Link to={`/admin/users/${id}`} className="font-medium hover:underline">
                      {nameOf(id)}
                    </Link>
                  </PanelItem>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </Page>
  )
}
