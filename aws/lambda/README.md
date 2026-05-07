# RUNA Lambda Backends

This folder contains the Lambda handlers used by RUNA after cloud migration.

## Required Lambda env vars

- Shared (for approvals/audit/policy):
  - `SUPABASE_URL` (required)
  - `SUPABASE_SERVICE_ROLE_KEY` (required)
- AI Lambda:
  - `GROQ_API_KEY` (required)
  - `GROQ_MODEL` (optional, default `llama-3.3-70b-versatile`)
  - `DEMO_SHARED_TOKEN` (optional)
  - **Knowledge base (RAG):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (required for retrieval); optional `RUNA_KB_TABLE` (default `runa_knowledge_chunks`), `RUNA_KB_TOP_K`, `RUNA_KB_MAX_CHUNK_CHARS`

## Knowledge base (Supabase)

Migration: `aws/supabase/migrations/003_runa_knowledge_chunks.sql`.

Seed from repo: `python scripts/seed_knowledge_base.py` (see `docs/KNOWLEDGE_BASE_SETUP.md`).

## Handlers

- `runa_ai_task_handler.py` → `runa_ai_task_handler.lambda_handler`
- `runa_approvals_handler.py` → `runa_approvals_handler.lambda_handler`
- `runa_audit_handler.py` → `runa_audit_handler.lambda_handler`
- `runa_policy_handler.py` → `runa_policy_handler.lambda_handler`
- Runtime: Python 3.12

## Function URLs

Create Function URLs (`POST`, CORS enabled) for all four handlers.
If you set `DEMO_SHARED_TOKEN` on AI Lambda, clients must send:

`x-api-key: <DEMO_SHARED_TOKEN>`

## Electron endpoint mapping

Set these in `electron/main.ts` `CLOUD_ENDPOINTS`:

- `approvals` -> approvals Lambda URL
- `audit` -> audit Lambda URL
- `policy` -> policy Lambda URL

AI is routed through sidecar (`python-service/service.py`) using `AI_LAMBDA_URL`.

## Supabase: audit envelope columns

Structured logging adds optional `event_description` and `threat_level` on `audit_log`.  
Apply the SQL in `aws/supabase/migrations/002_audit_envelope_columns.sql` before relying on those fields in PostgREST inserts.

## Supabase: lab attendance (institutional log)

- Migration: `aws/supabase/migrations/004_lab_attendance_sessions.sql` (`public.lab_attendance_sessions`).
- The **audit** Lambda (`runa_audit_handler.py`) exposes attendance via the same Function URL as `audit:list` / `audit:log`, with extra `op` values:
  - `attendance_check_in` — body: `studentEmail`, `comlabId`, `comlabLabel`, `workstationLabel`, `professorName`
  - `attendance_check_out` — body: `studentEmail`, `comlabId`
  - `attendance_list` — body: `comlabId`, optional `limit`; returns rows with camelCase fields (`timeIn`, `timeOut`, etc.)

Redeploy the audit Lambda after changing the handler; apply migration `004` before expecting rows in the admin **Institutional attendance** tab.

## Client config (if still using local runtime config)

```env
AI_PROVIDER=lambda
AI_LAMBDA_URL=https://<ai-function-id>.lambda-url.<region>.on.aws/
AI_LAMBDA_API_KEY=<same-as-DEMO_SHARED_TOKEN>
```

Do not store `GROQ_API_KEY` on laptops.
