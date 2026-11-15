import * as React from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateProjectStage } from '@/data/queries'
import { errorMessage } from '@/data/queries-mentor'
import { stageLabels, stageOrder } from '@/lib/format'
import { useToast } from '@/lib/toast'
import type { Project, ProjectStage } from '@/types'

/**
 * Stage picker + save button for mentors. Stages can only move forward
 * (stageOrder in lib/format): earlier stages are shown but disabled.
 */
export function StageForwardSelect({
  project,
  onSaved,
}: {
  project: Project
  onSaved: (project: Project) => void
}) {
  const { showToast } = useToast()
  const [draft, setDraft] = React.useState<ProjectStage>(project.current_stage)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setDraft(project.current_stage)
  }, [project.current_stage])

  const currentIndex = stageOrder.indexOf(project.current_stage)
  const atFinalStage = currentIndex === stageOrder.length - 1

  async function handleSave() {
    if (draft === project.current_stage) return
    if (stageOrder.indexOf(draft) < currentIndex) {
      setError('Stages can only move forward.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateProjectStage(project.id, draft)
      onSaved(updated)
      showToast(`Stage updated to ${stageLabels[updated.current_stage]}`)
    } catch (err) {
      const message = errorMessage(err, 'Failed to update stage')
      setError(message)
      showToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Select value={draft} onValueChange={(v) => setDraft(v as ProjectStage)} disabled={saving || atFinalStage}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stageOrder.map((s, i) => (
            <SelectItem key={s} value={s} disabled={i < currentIndex}>
              {stageLabels[s]}
              {i === currentIndex && ' (current)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        className="w-full"
        onClick={handleSave}
        disabled={saving || draft === project.current_stage}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        Save stage
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        {atFinalStage
          ? 'This project is at the final stage.'
          : 'Stages only move forward — earlier stages are locked.'}
      </p>
    </div>
  )
}
