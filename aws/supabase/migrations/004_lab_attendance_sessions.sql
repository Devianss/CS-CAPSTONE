-- Formal lab attendance (check-in / check-out) per workstation.
-- Written via audit Lambda ops: attendance_check_in | attendance_check_out | attendance_list.

create table if not exists public.lab_attendance_sessions (
  id bigint generated always as identity primary key,
  student_email text not null,
  comlab_id text not null,
  comlab_label text not null default '',
  workstation_label text not null default '',
  professor_name text not null default '',
  time_in timestamptz not null default now(),
  time_out timestamptz null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lab_attendance_comlab_time_in
  on public.lab_attendance_sessions (comlab_id, time_in desc);

create index if not exists idx_lab_attendance_student_open
  on public.lab_attendance_sessions (student_email, comlab_id)
  where time_out is null;

comment on table public.lab_attendance_sessions is 'RUNA lab attendance: time in/out, comlab, workstation, student email, professor.';
