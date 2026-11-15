import * as React from 'react'
import { Building2, ListChecks, Loader2, MessageSquare, Save } from 'lucide-react'
import { Page, PageHeader } from '@/components/PageHeader'
import { PageError, PageLoading } from '@/components/PageState'
import { Button } from '@/components/ui/button'
import { getSettings, updateSettings } from '@/data/queries'
import { stageLabels, stageOrder } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { ProjectStage, Settings } from '@/types'

type SettingsForm = Omit<Settings, 'id' | 'updated_at'>

const fieldClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40'

function toForm({ id: _id, updated_at: _updatedAt, ...rest }: Settings): SettingsForm {
  return rest
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-muted p-2">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-1 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block size-5 transform rounded-full bg-background shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export function AdminSettings() {
  const { showToast } = useToast()
  const [form, setForm] = React.useState<SettingsForm | null>(null)
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    getSettings()
      .then((data) => {
        if (cancelled) return
        setForm(toForm(data))
        setUpdatedAt(data.updated_at)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load settings'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function set<K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) {
    setForm((f) => (f ? { ...f, [field]: value } : f))
    setDirty(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateSettings(form)
      setForm(toForm(updated))
      setUpdatedAt(updated.updated_at)
      setDirty(false)
      showToast('Settings saved')
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Administrator"
        title="Settings"
        description="Configure programme-wide details, communication channels, and programme rules."
        action={
          form && (
            <div className="flex items-center gap-3">
              {updatedAt && !dirty && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Last saved {new Date(updatedAt).toLocaleString()}
                </span>
              )}
              {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
              <Button type="submit" form="settings-form" className="rounded-lg px-3" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Changes
              </Button>
            </div>
          )
        }
      />

      {loading && <PageLoading />}
      {!loading && (loadError || !form) && <PageError>{loadError ?? 'Failed to load settings'}</PageError>}

      {!loading && form && (
        <form id="settings-form" className="space-y-8" onSubmit={handleSubmit}>
          {saveError && <PageError>{saveError}</PageError>}

          <Section icon={Building2} title="General" description="Core programme information shown across the platform.">
            <div className="grid grid-cols-1 gap-4">
              <Field id="programme_name" label="Programme Name">
                <input
                  id="programme_name"
                  className={fieldClass}
                  value={form.programme_name}
                  onChange={(e) => set('programme_name', e.target.value)}
                  required
                />
              </Field>
              <Field id="programme_description" label="Programme Description">
                <textarea
                  id="programme_description"
                  rows={3}
                  className={fieldClass}
                  value={form.programme_description ?? ''}
                  onChange={(e) => set('programme_description', e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section
            icon={MessageSquare}
            title="Communication"
            description="Community channels and curriculum shared with learners."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                id="discord_invite_url"
                label="Discord Invite Link"
                hint="Used across the LMS for community and mentor support."
              >
                <input
                  id="discord_invite_url"
                  type="url"
                  className={fieldClass}
                  value={form.discord_invite_url ?? ''}
                  onChange={(e) => set('discord_invite_url', e.target.value)}
                />
              </Field>
              <Field
                id="notion_url"
                label="Notion Curriculum Link"
                hint="Used across the LMS for curriculum, resources, and templates."
              >
                <input
                  id="notion_url"
                  type="url"
                  className={fieldClass}
                  value={form.notion_url ?? ''}
                  onChange={(e) => set('notion_url', e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section icon={ListChecks} title="Programme Rules" description="Defaults applied to student projects.">
            <div className="space-y-1">
              <div className="max-w-xs pb-2">
                <Field
                  id="default_stage"
                  label="Default Project Stage"
                  hint="The stage new student-created projects start at."
                >
                  <select
                    id="default_stage"
                    className={fieldClass}
                    value={form.default_stage}
                    onChange={(e) => set('default_stage', e.target.value as ProjectStage)}
                  >
                    {stageOrder.map((s) => (
                      <option key={s} value={s}>
                        {stageLabels[s]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Toggle
                label="Weekly progress update required"
                description="Students are expected to post a progress update every week."
                checked={form.progress_update_required}
                onChange={(v) => set('progress_update_required', v)}
              />
            </div>
          </Section>
        </form>
      )}
    </Page>
  )
}
