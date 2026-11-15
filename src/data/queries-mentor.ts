import { supabase } from '@/lib/supabaseClient'
import { listMentorAssignments } from '@/data/queries'
import type {
  AttendanceRecord,
  MentorComment,
  ProgressUpdate,
  Session,
  User,
} from '@/types'

// ============================================================
// Queries
// ============================================================

/**
 * Every active student in the programme. Mentors see all of them, not only
 * the ones assigned to them (owner decision); use `listMyAssignedStudentIds`
 * to badge or filter the assigned ones.
 */
export async function listActiveStudents(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'student')
    .eq('is_active', true)
    .order('full_name')
  if (error) throw error
  return data ?? []
}

/** Ids of the students an admin assigned to this mentor. */
export async function listMyAssignedStudentIds(mentorId: string): Promise<Set<string>> {
  const assignments = await listMentorAssignments({ mentorId })
  return new Set(assignments.map((a) => a.student_id))
}

/** Every progress update, newest first. Filter to the students you need client-side. */
export async function listAllProgressUpdates(): Promise<ProgressUpdate[]> {
  const { data, error } = await supabase
    .from('progress_updates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Every attendance record (mentors can read all of them). */
export async function listAllAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase.from('attendance_records').select('*')
  if (error) throw error
  return data ?? []
}

export async function getProgressUpdate(id: string): Promise<ProgressUpdate | null> {
  const { data, error } = await supabase
    .from('progress_updates')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getMentorComment(id: string): Promise<MentorComment | null> {
  const { data, error } = await supabase
    .from('mentor_comments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Lightweight id → name map of cohorts (no member counts). */
export async function listCohortNames(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('cohorts').select('id, name')
  if (error) throw error
  return new Map((data ?? []).map((c) => [c.id as string, c.name as string]))
}

// ============================================================
// Derived data (pure helpers shared by the mentor pages)
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000

/** A pending update older than this many days counts as overdue. */
export const REVIEW_OVERDUE_DAYS = 3
/** No progress update for this many days → needs attention. */
export const STALE_UPDATE_DAYS = 7
/** No progress update for this many days → at risk. */
export const AT_RISK_UPDATE_DAYS = 14

export function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
}

/** A readable message from anything thrown (Supabase errors aren't always `Error`s). */
export function errorMessage(err: unknown, fallback: string) {
  const raw =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : ''
  if (/stage can only move forward/i.test(raw)) {
    return 'Project stages can only move forward — pick a later stage.'
  }
  return raw || fallback
}

/**
 * Feedback for each progress update. A comment with `progress_update_id`
 * belongs to that update. Older comments without one (general project
 * feedback) fall back to the update they follow: the latest update of the
 * same project posted at or before the comment. Comments made before a
 * project's first update map to no update (key `null`).
 */
export function groupFeedbackByUpdate(
  updates: ProgressUpdate[],
  comments: MentorComment[],
): Map<string | null, MentorComment[]> {
  const byProject = new Map<string, ProgressUpdate[]>()
  for (const u of updates) {
    const list = byProject.get(u.project_id) ?? []
    list.push(u)
    byProject.set(u.project_id, list)
  }
  for (const list of byProject.values()) {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  const result = new Map<string | null, MentorComment[]>()
  const knownIds = new Set(updates.map((u) => u.id))
  for (const c of comments) {
    let key: string | null
    if (c.progress_update_id && knownIds.has(c.progress_update_id)) {
      key = c.progress_update_id
    } else {
      const t = new Date(c.created_at).getTime()
      const target = (byProject.get(c.project_id) ?? []).find(
        (u) => new Date(u.created_at).getTime() <= t,
      )
      key = target?.id ?? null
    }
    const list = result.get(key) ?? []
    list.push(c)
    result.set(key, list)
  }
  return result
}

export type ReviewStatus = 'pending' | 'reviewed' | 'overdue'

export function reviewStatus(update: ProgressUpdate, feedback: MentorComment[] | undefined): ReviewStatus {
  if (feedback && feedback.length > 0) return 'reviewed'
  return daysSince(update.created_at) >= REVIEW_OVERDUE_DAYS ? 'overdue' : 'pending'
}

export const reviewStatusMeta: Record<
  ReviewStatus,
  { label: string; tone: 'warning' | 'success' | 'destructive' }
> = {
  pending: { label: 'Pending', tone: 'warning' },
  reviewed: { label: 'Reviewed', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'destructive' },
}

export type StudentStatus = 'on-track' | 'needs-attention' | 'at-risk'

export const studentStatusMeta: Record<
  StudentStatus,
  { label: string; tone: 'success' | 'warning' | 'destructive' }
> = {
  'on-track': { label: 'On Track', tone: 'success' },
  'needs-attention': { label: 'Needs Attention', tone: 'warning' },
  'at-risk': { label: 'At Risk', tone: 'destructive' },
}

export type AttentionReason = 'no-updates' | 'missed-sessions' | 'low-attendance'

export interface StudentHealth {
  status: StudentStatus
  /** Days since the latest progress update, or null if they never posted one. */
  daysSinceUpdate: number | null
  /** Percentage of marked sessions they were present at, or null if none marked. */
  attendance: number | null
  reasons: { reason: AttentionReason; detail: string }[]
}

/**
 * How a student is doing, from their progress updates and attendance:
 * - at risk: no update ever, none in 14+ days, or attendance below 70%
 * - needs attention: no update in 7+ days, attendance below 85%, or the
 *   last two marked sessions both missed
 * - otherwise on track
 */
export function studentHealth(
  studentUpdates: ProgressUpdate[],
  studentAttendance: AttendanceRecord[],
  sessionsById: Map<string, Session>,
): StudentHealth {
  const latest = studentUpdates.reduce<string | null>(
    (max, u) => (max === null || u.created_at > max ? u.created_at : max),
    null,
  )
  const daysSinceUpdate = latest ? daysSince(latest) : null

  const attendance =
    studentAttendance.length === 0
      ? null
      : Math.round(
          (studentAttendance.filter((r) => r.status === 'present').length /
            studentAttendance.length) *
            100,
        )

  const recent = [...studentAttendance]
    .map((r) => ({ r, s: sessionsById.get(r.session_id) }))
    .sort(
      (a, b) =>
        new Date(b.s?.start_time ?? b.r.marked_at).getTime() -
        new Date(a.s?.start_time ?? a.r.marked_at).getTime(),
    )
    .slice(0, 2)
  const missedLastTwo = recent.length === 2 && recent.every(({ r }) => r.status === 'absent')

  const reasons: StudentHealth['reasons'] = []
  if (daysSinceUpdate === null) {
    reasons.push({ reason: 'no-updates', detail: 'No progress updates posted yet' })
  } else if (daysSinceUpdate >= STALE_UPDATE_DAYS) {
    reasons.push({ reason: 'no-updates', detail: `No progress update in ${daysSinceUpdate} days` })
  }
  if (missedLastTwo) {
    reasons.push({
      reason: 'missed-sessions',
      detail: `Missed ${recent.map(({ s }) => s?.title ?? 'a session').join(' and ')}`,
    })
  }
  if (attendance !== null && attendance < 85) {
    reasons.push({ reason: 'low-attendance', detail: `Attendance at ${attendance}%` })
  }

  let status: StudentStatus = 'on-track'
  if (
    daysSinceUpdate === null ||
    daysSinceUpdate >= AT_RISK_UPDATE_DAYS ||
    (attendance !== null && attendance < 70)
  ) {
    status = 'at-risk'
  } else if (reasons.length > 0) {
    status = 'needs-attention'
  }

  return { status, daysSinceUpdate, attendance, reasons }
}

export const attentionReasonMeta: Record<
  AttentionReason,
  { label: string; tone: 'warning' | 'destructive' }
> = {
  'no-updates': { label: 'No recent updates', tone: 'warning' },
  'missed-sessions': { label: 'Missed sessions', tone: 'destructive' },
  'low-attendance': { label: 'Low attendance', tone: 'warning' },
}

export function lastUpdateLabel(days: number | null) {
  if (days === null) return 'No updates'
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 14) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
