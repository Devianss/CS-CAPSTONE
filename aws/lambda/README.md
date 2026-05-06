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

## Client config (if still using local runtime config)

```env
AI_PROVIDER=lambda
AI_LAMBDA_URL=https://<ai-function-id>.lambda-url.<region>.on.aws/
AI_LAMBDA_API_KEY=<same-as-DEMO_SHARED_TOKEN>
```

Do not store `GROQ_API_KEY` on laptops.
