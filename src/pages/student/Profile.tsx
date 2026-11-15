import * as React from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, Briefcase, ClipboardList, GitBranch, KeyRound, Loader2, Mail, MessageCircle, Save, UserRound } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import {
  getCohort,
  getIntakeForm,
  getUserNames,
  listMentorAssignments,
  saveIntakeForm,
  updateOwnProfile,
} from '@/data/queries'
import { formatDate } from '@/lib/format'
import { cn, getErrorMessage } from '@/lib/utils'
import type { IntakeForm } from '@/types'

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring'

function Field({
  label,
  icon,
  hint,
  children,
  required,
  className,
}: {
  label: string
  icon?: React.ReactNode
  hint?: string
  children: React.ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
        {icon}
        {hint && <span className="text-[10px] text-muted-foreground/70">({hint})</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function Header({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  )
}

const experienceLabels: Record<IntakeForm['experience_level'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

function IntakeSection({
  studentId,
  intake,
  onSaved,
}: {
  studentId: string
  intake: IntakeForm | null
  onSaved: (intake: IntakeForm) => void
}) {
  const [editing, setEditing] = React.useState(!intake)
  const [form, setForm] = React.useState({
    experience_level: intake?.experience_level ?? ('' as IntakeForm['experience_level'] | ''),
    motivation: intake?.motivation ?? '',
    goals: intake?.goals ?? '',
  })
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setEditing(!intake)
    setForm({
      experience_level: intake?.experience_level ?? '',
      motivation: intake?.motivation ?? '',
      goals: intake?.goals ?? '',
    })
  }, [intake])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.experience_level || !form.motivation.trim() || !form.goals.trim()) {
      setError('Please fill in all three fields.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await saveIntakeForm({
        student_id: studentId,
        experience_level: form.experience_level,
        motivation: form.motivation.trim(),
        goals: form.goals.trim(),
      })
      onSaved(saved)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save intake form'))
    } finally {
      setSaving(false)
    }
  }

  const editButton = intake && !editing && (
    <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-primary hover:underline">
      Edit
    </button>
  )

  return (
    <Panel>
      <Header icon={ClipboardList} title="Intake form" action={editButton} />
      {intake && !editing ? (
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Row label="Experience level">{experienceLabels[intake.experience_level]}</Row>
          <Row label="Submitted">{formatDate(intake.submitted_at)}</Row>
          <div className="sm:col-span-2">
            <Row label="Why did you join?">
              <span className="whitespace-pre-line font-normal">{intake.motivation}</span>
            </Row>
          </div>
          <div className="sm:col-span-2">
            <Row label="What do you want to achieve?">
              <span className="whitespace-pre-line font-normal">{intake.goals}</span>
            </Row>
          </div>
        </dl>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-xs text-muted-foreground">
            {intake ? 'Update your answers.' : 'Tell your mentors where you are starting from.'}
          </p>
          <Field label="Experience level" required>
            <select
              className={inputCls}
              value={form.experience_level}
              onChange={(e) =>
                setForm((f) => ({ ...f, experience_level: e.target.value as IntakeForm['experience_level'] }))
              }
            >
              <option value="" disabled>
                Choose one
              </option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>
          <Field label="Why did you join?" required>
            <textarea
              rows={3}
              className={inputCls}
              value={form.motivation}
              onChange={(e) => setForm((f) => ({ ...f, motivation: e.target.value }))}
            />
          </Field>
          <Field label="What do you want to achieve?" required>
            <textarea
              rows={3}
              className={inputCls}
              value={form.goals}
              onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            {intake && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {intake ? 'Save' : 'Submit'}
            </button>
          </div>
        </form>
      )}
    </Panel>
  )
}

export function StudentProfile() {
  const { user, refreshProfile } = useAuth()
  const [form, setForm] = React.useState({
    full_name: user.full_name,
    slack_username: user.slack_username ?? '',
    whatsapp_number: user.whatsapp_number ?? '',
    linkedin_url: user.linkedin_url ?? '',
    github_url: user.github_url ?? '',
  })
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)
  const [intake, setIntake] = React.useState<IntakeForm | null>(null)
  const [intakeLoaded, setIntakeLoaded] = React.useState(false)
  const [cohortName, setCohortName] = React.useState<string | null>(null)
  const [mentorNames, setMentorNames] = React.useState<string[]>([])

  React.useEffect(() => {
    let cancelled = false
    if (user.role !== 'student') return
    getIntakeForm(user.id)
      .then((data) => {
        if (cancelled) return
        setIntake(data)
        setIntakeLoaded(true)
      })
      .catch(() => {
        // Non-critical for this page; leave the intake section hidden on failure.
      })
    if (user.cohort_id) {
      getCohort(user.cohort_id)
        .then((c) => !cancelled && setCohortName(c.name))
        .catch(() => {})
    }
    listMentorAssignments({ studentIds: [user.id] })
      .then((rows) => getUserNames(rows.map((r) => r.mentor_id)))
      .then((names) => !cancelled && setMentorNames(names.map((n) => n.full_name)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user.id, user.cohort_id, user.role])

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setSaved(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      setSaveError('Full name is required.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await updateOwnProfile(user.id, { ...form, full_name: form.full_name.trim() })
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save profile'))
    } finally {
      setSaving(false)
    }
  }

  const initials = form.full_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Keep your details accurate so your mentor and cohort can reach you."
      />

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
            {initials || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold">{user.full_name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            <div className="mt-1 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium capitalize text-accent-foreground">
              {user.role}
            </div>
          </div>
          <Link
            to="/set-password"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <KeyRound className="size-3.5" />
            Change password
          </Link>
        </div>
      </section>

      <form onSubmit={handleSave} className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-4">
          <Header icon={UserRound} title="Basic Information" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Full name" required>
              <input className={inputCls} value={form.full_name} onChange={update('full_name')} />
            </Field>
            <Field label="Email" icon={<Mail className="size-3" />}>
              <input type="email" readOnly className={cn(inputCls, 'cursor-not-allowed bg-muted/50')} value={user.email} />
            </Field>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Use your exact registration name. Avoid nicknames or alternative names, as this information is used for
            cohort records, attendance tracking, certificates, and programme administration.
          </p>
        </div>

        <div className="space-y-4 border-t border-border pt-5">
          <Header icon={MessageCircle} title="Contact Information" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Slack username">
              <input className={inputCls} value={form.slack_username} onChange={update('slack_username')} />
            </Field>
            <Field label="WhatsApp number" hint="preferred">
              <input className={inputCls} value={form.whatsapp_number} onChange={update('whatsapp_number')} />
            </Field>
            <Field label="LinkedIn URL" icon={<Briefcase className="size-3" />}>
              <input type="url" className={inputCls} value={form.linkedin_url} onChange={update('linkedin_url')} />
            </Field>
            <Field label="GitHub URL" icon={<GitBranch className="size-3" />} hint="optional">
              <input type="url" className={inputCls} value={form.github_url} onChange={update('github_url')} />
            </Field>
          </div>
        </div>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </form>

      {user.role === 'student' && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Header icon={BookOpen} title="Cohort Information" />
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Row label="Cohort">{cohortName ?? 'Not assigned yet'}</Row>
            <Row label="Assigned mentor">{mentorNames.length ? mentorNames.join(', ') : 'Not assigned yet'}</Row>
          </dl>
        </section>
      )}

      {user.role === 'student' && intakeLoaded && <IntakeSection studentId={user.id} intake={intake} onSaved={setIntake} />}
    </div>
  )
}
