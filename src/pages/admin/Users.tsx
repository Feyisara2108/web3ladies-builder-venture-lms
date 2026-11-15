import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { GraduationCap, MailPlus, ShieldCheck, UserCheck, Users as UsersIcon } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Page, PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { DataTable, EmptyRow, RowLink, Td, Tr } from '@/components/DataTable'
import { SearchInput, SegmentedFilter } from '@/components/ListControls'
import { PageError, PageLoading } from '@/components/PageState'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import { listCohorts, listUsers } from '@/data/queries'
import { formatDate } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import type { Cohort, Role, User } from '@/types'
import { getUserStatus, roleTone, userStatusTone, type UserStatus } from './helpers'
import { DeactivateButton, EditUserDialog, InviteUserDialog } from './UserDialogs'

type FilterId = 'all' | Role | UserStatus

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'student', label: 'Students' },
  { id: 'mentor', label: 'Mentors' },
  { id: 'admin', label: 'Admins' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'inactive', label: 'Inactive' },
]

const ROLES: Role[] = ['student', 'mentor', 'admin']

export function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = React.useState<User[]>([])
  const [cohorts, setCohorts] = React.useState<Cohort[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<FilterId>('all')

  // ?invite=student|mentor|admin opens the invite dialog (dashboard quick actions).
  const inviteParam = searchParams.get('invite')
  const inviteRole: Role = ROLES.includes(inviteParam as Role) ? (inviteParam as Role) : 'student'
  const [inviteOpen, setInviteOpen] = React.useState(inviteParam !== null)

  function handleInviteOpenChange(open: boolean) {
    setInviteOpen(open)
    if (!open && searchParams.has('invite')) {
      searchParams.delete('invite')
      setSearchParams(searchParams, { replace: true })
    }
  }

  React.useEffect(() => {
    let cancelled = false
    Promise.all([listUsers(), listCohorts()])
      .then(([userData, cohortData]) => {
        if (cancelled) return
        setUsers(userData)
        setCohorts(cohortData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load users'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleUserSaved(updated: User) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }

  const counts = {
    total: users.length,
    students: users.filter((u) => u.role === 'student').length,
    mentors: users.filter((u) => u.role === 'mentor').length,
    activeMentors: users.filter((u) => u.role === 'mentor' && u.is_active).length,
    admins: users.filter((u) => u.role === 'admin').length,
  }

  const q = query.trim().toLowerCase()
  const visible = users.filter((u) => {
    if (filter === 'student' || filter === 'mentor' || filter === 'admin') {
      if (u.role !== filter) return false
    } else if (filter !== 'all' && getUserStatus(u) !== filter) {
      return false
    }
    if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
    return true
  })

  return (
    <Page>
      <PageHeader
        eyebrow="Administrator"
        title="Users"
        description="Manage all platform users, roles, and cohort assignments. Invite-only — only admins can create accounts."
        action={
          <Button className="rounded-lg px-3" onClick={() => setInviteOpen(true)} disabled={loading}>
            <MailPlus className="size-4" /> Invite User
          </Button>
        }
      />

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={handleInviteOpenChange}
        cohorts={cohorts}
        initialRole={inviteRole}
        onInvited={async () => setUsers(await listUsers())}
      />

      {loading && <PageLoading />}
      {!loading && loadError && <PageError>{loadError}</PageError>}

      {!loading && !loadError && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={UsersIcon} label="Total Users" value={counts.total} hint="All roles" />
            <StatCard icon={GraduationCap} label="Students" value={counts.students} hint="Enrolled learners" />
            <StatCard
              icon={UserCheck}
              label="Mentors"
              value={counts.mentors}
              hint={`${counts.activeMentors} active mentors`}
            />
            <StatCard icon={ShieldCheck} label="Administrators" value={counts.admins} hint="Programme admins" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search by name or email…" />
            <SegmentedFilter options={FILTERS} value={filter} onChange={setFilter} />
          </div>

          <DataTable
            head={[
              { label: 'Name' },
              { label: 'Email' },
              { label: 'Role' },
              { label: 'Cohort' },
              { label: 'Status' },
              { label: 'Joined' },
              { label: 'Action', align: 'right' },
            ]}
          >
            {visible.map((u) => {
              const status = getUserStatus(u)
              return (
                <Tr key={u.id} className={u.is_active ? undefined : 'opacity-60'}>
                  <Td strong>{u.full_name}</Td>
                  <Td muted>{u.email}</Td>
                  <Td>
                    <Tag tone={roleTone[u.role]} className="capitalize">
                      {u.role}
                    </Tag>
                  </Td>
                  <Td muted>{cohorts.find((c) => c.id === u.cohort_id)?.name ?? '—'}</Td>
                  <Td>
                    <Tag tone={userStatusTone[status]} className="capitalize">
                      {status}
                    </Tag>
                  </Td>
                  <Td muted className="whitespace-nowrap">
                    {formatDate(u.created_at)}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      {u.id !== currentUser.id && (
                        <>
                          <EditUserDialog user={u} cohorts={cohorts} onSaved={handleUserSaved} />
                          <DeactivateButton user={u} onChanged={handleUserSaved} />
                        </>
                      )}
                      <RowLink to={`/admin/users/${u.id}`}>View User</RowLink>
                    </div>
                  </Td>
                </Tr>
              )
            })}
            {visible.length === 0 && (
              <EmptyRow colSpan={7}>
                {users.length === 0 ? 'No users yet — invite the first one.' : 'No users match your search.'}
              </EmptyRow>
            )}
          </DataTable>
        </>
      )}
    </Page>
  )
}
