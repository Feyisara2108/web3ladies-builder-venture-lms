// Shared, non-component helpers for the admin pages.
import type { TagTone } from '@/components/Tag'
import type {
  AttendanceRecord,
  CohortStatus,
  ProgressUpdate,
  ProjectStage,
  Role,
  Session,
  SessionStatus,
  User,
} from '@/types'

export const DAY_MS = 24 * 60 * 60 * 1000

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** % of marked attendance records that are "present", or null when nothing is marked. */
export function attendanceRate(
  records: AttendanceRecord[],
  filterFn: (r: AttendanceRecord) => boolean = () => true,
) {
  const scoped = records.filter(filterFn)
  if (scoped.length === 0) return null
  const present = scoped.filter((r) => r.status === 'present').length
  return Math.round((present / scoped.length) * 100)
}

export function formatRate(rate: number | null) {
  return rate === null ? '—' : `${rate}%`
}

export const cohortStatusTone: Record<CohortStatus, TagTone> = {
  active: 'green',
  upcoming: 'blue',
  completed: 'muted',
  archived: 'amber',
}

export type UserStatus = 'active' | 'pending' | 'inactive'

export function getUserStatus(user: User): UserStatus {
  if (!user.is_active) return 'inactive'
  return user.invite_accepted_at ? 'active' : 'pending'
}

export const userStatusTone: Record<UserStatus, TagTone> = {
  active: 'green',
  pending: 'amber',
  inactive: 'muted',
}

export const roleTone: Record<Role, TagTone> = {
  student: 'blue',
  mentor: 'green',
  admin: 'purple',
}

export const sessionStatusTone: Record<SessionStatus, TagTone> = {
  scheduled: 'blue',
  active: 'primary',
  completed: 'green',
  cancelled: 'red',
}

export const sessionStatusLabel: Record<SessionStatus, string> = {
  scheduled: 'Scheduled',
  active: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const sessionTypeLabel: Record<Session['type'], string> = {
  'live-class': 'Live class',
  workshop: 'Workshop',
  'office-hours': 'Office hours',
  'demo-day': 'Demo day',
}

export const sessionLocationLabel: Record<Session['location'], string> = {
  discord: 'Discord',
  zoom: 'Zoom',
  'google-meet': 'Google Meet',
  'in-person': 'In person',
}

export const stageTone: Record<ProjectStage, TagTone> = {
  ideation: 'muted',
  validation: 'amber',
  building: 'purple',
  testing: 'blue',
  launch: 'green',
}

/**
 * Project health, derived from how recently the student posted a
 * progress update: within 7 days = active, 7–14 days = at risk, older
 * (or never) = stalled. Launch-stage projects count as completed.
 */
export type ProjectHealth = 'active' | 'at risk' | 'stalled' | 'completed'

export function projectHealth(stage: ProjectStage, lastUpdateAt: string | null): ProjectHealth {
  if (stage === 'launch') return 'completed'
  if (!lastUpdateAt) return 'stalled'
  const age = Date.now() - new Date(lastUpdateAt).getTime()
  if (age <= 7 * DAY_MS) return 'active'
  if (age <= 14 * DAY_MS) return 'at risk'
  return 'stalled'
}

export const projectHealthTone: Record<ProjectHealth, TagTone> = {
  active: 'green',
  'at risk': 'amber',
  stalled: 'red',
  completed: 'blue',
}

/** Latest progress update timestamp per project id. */
export function latestUpdateByProject(updates: ProgressUpdate[]) {
  const map = new Map<string, string>()
  for (const u of updates) {
    const prev = map.get(u.project_id)
    if (!prev || u.created_at > prev) map.set(u.project_id, u.created_at)
  }
  return map
}

export function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatSessionTime(start: string, end?: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  const s = new Date(start).toLocaleTimeString(undefined, opts)
  if (!end) return s
  return `${s} – ${new Date(end).toLocaleTimeString(undefined, opts)}`
}

/** Short relative time: "25m ago", "3h ago", "2d ago", or a date when older. */
export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatSessionDate(iso)
}
