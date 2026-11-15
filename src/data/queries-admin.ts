// Admin-only data helpers used by the redesigned admin pages. Kept apart
// from queries.ts so parallel work on the shared queries doesn't collide.
import { supabase } from '@/lib/supabaseClient'
import type { AttendanceRecord, Project, ProjectStage, ProgressUpdate, Session, SessionStatus } from '@/types'

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function getSession(id: string): Promise<Session> {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

/** Every attendance record in the programme (admins can read all). */
export async function listAllAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase.from('attendance_records').select('*')
  if (error) throw error
  return data ?? []
}

/** Every progress update, newest first. */
export async function listAllProgressUpdates(): Promise<ProgressUpdate[]> {
  const { data, error } = await supabase
    .from('progress_updates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listProgressUpdatesForProject(projectId: string): Promise<ProgressUpdate[]> {
  const { data, error } = await supabase
    .from('progress_updates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface CreatedRow {
  id: string
  label: string
  cohort_id?: string | null
  created_at: string
}

/** Most recently created cohorts and sessions, for the dashboard activity feed. */
export async function listRecentCreations(limit = 10): Promise<{
  cohorts: CreatedRow[]
  sessions: CreatedRow[]
}> {
  const [cohortRes, sessionRes] = await Promise.all([
    supabase
      .from('cohorts')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('sessions')
      .select('id, title, cohort_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])
  if (cohortRes.error) throw cohortRes.error
  if (sessionRes.error) throw sessionRes.error
  return {
    cohorts: (cohortRes.data ?? []).map((c) => ({ id: c.id, label: c.name, created_at: c.created_at })),
    sessions: (sessionRes.data ?? []).map((s) => ({
      id: s.id,
      label: s.title,
      cohort_id: s.cohort_id,
      created_at: s.created_at,
    })),
  }
}

export interface SessionInput {
  cohort_id: string
  title: string
  type: Session['type']
  stage: ProjectStage | null
  start_time: string
  end_time: string
  facilitator_id: string
  location: Session['location']
  link: string | null
  description: string | null
  learning_objectives: string | null
  resources_url: string | null
  recording_url: string | null
}

/** Like createSession in queries.ts, but also accepts recording_url. */
export async function createSessionAdmin(input: SessionInput): Promise<Session> {
  const { data, error } = await supabase.from('sessions').insert(input).select().single()
  if (error) throw error
  return data
}

/** Like updateSession in queries.ts, but also accepts recording_url. */
export async function updateSessionAdmin(
  id: string,
  input: Partial<SessionInput & { status: SessionStatus }>,
): Promise<Session> {
  const { data, error } = await supabase.from('sessions').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}
