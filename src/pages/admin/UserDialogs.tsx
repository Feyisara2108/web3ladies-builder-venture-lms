import * as React from 'react'
import { Loader2, Pencil, UserCheck, UserX } from 'lucide-react'
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
import { inviteUser, setUserActive, updateUser } from '@/data/queries'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Cohort, Role, User } from '@/types'

function CohortSelect({
  cohorts,
  value,
  onChange,
}: {
  cohorts: Cohort[]
  value: string
  onChange: (v: string) => void
}) {
  if (cohorts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No cohorts exist yet — create one on the Cohorts page first.
      </p>
    )
  }
  return (
    <Select value={value} onValueChange={onChange}>
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
  )
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (v: Role) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="student">Student</SelectItem>
        <SelectItem value="mentor">Mentor</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  )
}

/**
 * Change a user's role / cohort. Admin-only fields (see migration 0009),
 * so this only works when the signed-in user is an admin.
 */
export function EditUserDialog({
  user,
  cohorts,
  onSaved,
  trigger,
}: {
  user: User
  cohorts: Cohort[]
  onSaved: (updated: User) => void
  trigger?: React.ReactNode
}) {
  const { showToast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<Role>(user.role)
  const [cohortId, setCohortId] = React.useState(user.cohort_id ?? '')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setRole(user.role)
      setCohortId(user.cohort_id ?? '')
      setError(null)
    }
  }, [open, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateUser(user.id, {
        role,
        cohort_id: role === 'admin' ? null : cohortId || null,
      })
      onSaved(updated)
      setOpen(false)
      showToast('User updated')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update user'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" className="size-7">
            <Pencil className="size-3.5" />
            <span className="sr-only">Edit {user.full_name}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.full_name}</DialogTitle>
          <DialogDescription>Change their role or cohort assignment.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <RoleSelect value={role} onChange={setRole} />
          </div>
          {role !== 'admin' && (
            <div className="flex flex-col gap-2">
              <Label>Cohort</Label>
              <CohortSelect cohorts={cohorts} value={cohortId} onChange={setCohortId} />
            </div>
          )}
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

/** Activate / deactivate an account via the set-user-active Edge Function. */
export function DeactivateButton({
  user,
  onChanged,
  variant = 'icon',
}: {
  user: User
  onChanged: (updated: User) => void
  variant?: 'icon' | 'full'
}) {
  const { showToast } = useToast()
  const [busy, setBusy] = React.useState(false)

  async function handleToggle() {
    setBusy(true)
    try {
      const updated = await setUserActive(user.id, !user.is_active)
      onChanged(updated)
      showToast(updated.is_active ? `${user.full_name} activated` : `${user.full_name} deactivated`)
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update account status'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const Icon = busy ? Loader2 : user.is_active ? UserX : UserCheck
  const label = user.is_active ? 'Deactivate' : 'Activate'

  if (variant === 'full') {
    return (
      <Button variant="outline" className="rounded-lg" onClick={handleToggle} disabled={busy}>
        <Icon className={busy ? 'size-4 animate-spin' : 'size-4'} /> {label}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={
        user.is_active
          ? 'size-7 text-muted-foreground hover:text-destructive'
          : 'size-7 text-muted-foreground hover:text-success'
      }
      onClick={handleToggle}
      disabled={busy}
    >
      <Icon className={busy ? 'size-3.5 animate-spin' : 'size-3.5'} />
      <span className="sr-only">
        {label} {user.full_name}
      </span>
    </Button>
  )
}

/** Invite a new user by email (invite-user Edge Function). Controlled. */
export function InviteUserDialog({
  open,
  onOpenChange,
  cohorts,
  initialRole = 'student',
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohorts: Cohort[]
  initialRole?: Role
  onInvited: () => void | Promise<void>
}) {
  const { showToast } = useToast()
  const [form, setForm] = React.useState<{ full_name: string; email: string; role: Role; cohort_id: string }>({
    full_name: '',
    email: '',
    role: initialRole,
    cohort_id: '',
  })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setForm({ full_name: '', email: '', role: initialRole, cohort_id: cohorts[0]?.id ?? '' })
      setError(null)
    }
  }, [open, initialRole, cohorts])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name || !form.email) return
    setSubmitting(true)
    setError(null)
    try {
      await inviteUser({
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        cohort_id: form.role === 'admin' ? null : form.cohort_id || null,
      })
      await onInvited()
      onOpenChange(false)
      showToast(`Invite sent to ${form.email}`)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send invite'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>They'll receive an email invite to set up their account.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <RoleSelect value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} />
          </div>
          {form.role !== 'admin' && (
            <div className="flex flex-col gap-2">
              <Label>Cohort</Label>
              <CohortSelect
                cohorts={cohorts}
                value={form.cohort_id}
                onChange={(v) => setForm((f) => ({ ...f, cohort_id: v }))}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
