-- Add structured audit envelope columns (Supabase SQL editor or CLI).
-- Run once per project before deploying Lambda that sends event_description / threat_level.

alter table public.audit_log
  add column if not exists event_description text;

alter table public.audit_log
  add column if not exists threat_level text check (threat_level is null or threat_level in ('low', 'medium', 'high'));

comment on column public.audit_log.event_description is 'Brief operator-readable summary of the audit event.';
comment on column public.audit_log.threat_level is 'Normalized threat severity: low | medium | high.';
