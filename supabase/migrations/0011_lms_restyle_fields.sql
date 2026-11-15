-- Fields used by the redesigned LMS pages.

-- Sessions: link to the recording (YouTube, Drive, Zoom cloud…),
-- alongside the existing resources_url used for the session's notes.
alter table public.sessions add column if not exists recording_url text;

-- Projects: extra details students fill in on their Project page.
alter table public.projects add column if not exists target_users text;
alter table public.projects add column if not exists figma_url text;
alter table public.projects add column if not exists notion_url text;

-- Project stage only moves forward for mentors (ideation → validation →
-- building → testing → launch). Admins can still move it back to fix
-- mistakes. Students still can't change it at all.
create or replace function public.protect_project_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stages constant text[] := array['ideation', 'validation', 'building', 'testing', 'launch'];
begin
  if new.current_stage is distinct from old.current_stage then
    if public.current_user_role() = 'student' then
      raise exception 'Students cannot change the project stage';
    end if;
    if public.current_user_role() = 'mentor'
       and array_position(stages, new.current_stage) < array_position(stages, old.current_stage) then
      raise exception 'Project stage can only move forward';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- Progress updates: the richer builder-log format
-- (worked on = summary, learned, blockers, next steps, links, related session).
alter table public.progress_updates add column if not exists learned text;
alter table public.progress_updates add column if not exists next_steps text;
alter table public.progress_updates add column if not exists links text[] not null default '{}';
alter table public.progress_updates add column if not exists related_session_id uuid
  references public.sessions (id) on delete set null;

-- Mentor feedback can be attached to a specific progress update
-- (still optional; general project feedback leaves it null).
alter table public.mentor_comments add column if not exists progress_update_id uuid
  references public.progress_updates (id) on delete cascade;
create index if not exists mentor_comments_progress_update_id_idx
  on public.mentor_comments (progress_update_id);

-- Profile contact details shown on the redesigned Profile page.
alter table public.users add column if not exists slack_username text;
alter table public.users add column if not exists whatsapp_number text;
alter table public.users add column if not exists linkedin_url text;
alter table public.users add column if not exists github_url text;

-- Students can see who their assigned mentor is.
create policy "mentor_assignments_select_self" on public.mentor_assignments
  for select using (student_id = auth.uid());
