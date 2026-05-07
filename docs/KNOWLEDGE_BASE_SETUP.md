# RUNA knowledge base (small RAG) — setup

The assistant’s **Retrieval-Augmented Generation** path runs **only in the AI Lambda**: it loads text chunks from Supabase (`runa_knowledge_chunks`), scores them against the user prompt, injects excerpts into the system message, and returns **citation metadata** (`ragCitations`, `ragUsed`) in the JSON response. Clients never query Supabase for KB data directly.

## 1. Apply the database migration

In Supabase SQL editor (or `psql`), run migrations in order if you have not already:

1. `aws/supabase/migrations/002_audit_envelope_columns.sql` (if you use structured audit fields)
2. `aws/supabase/migrations/003_runa_knowledge_chunks.sql` — creates `public.runa_knowledge_chunks`

## 2. Environment variables (AI Lambda)

Configure on the **AI** Lambda (`runa_ai_task_handler`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `GROQ_API_KEY` | Yes | LLM provider |
| `SUPABASE_URL` | Yes for RAG | Project URL (no trailing slash) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for RAG | Service role key for PostgREST reads |
| `RUNA_KB_TABLE` | No | Default `runa_knowledge_chunks` |
| `RUNA_KB_TOP_K` | No | Default top-k cap (Lambda also honors per-request `kbTopK`) |
| `RUNA_KB_MAX_CHUNK_CHARS` | No | Max characters per chunk injected into the prompt |
| `DEMO_SHARED_TOKEN` | Optional | If set, clients must send `x-api-key` |

**Security:** Use the **service role** only on the Lambda. Do not ship it to Electron or the Python sidecar; the sidecar calls Lambda, which reads Supabase.

## 3. Seed content from markdown

Markdown sources live under `knowledge/` in the repo. From the **repository root**, with credentials available either **in the environment** or in a **`.env`** file beside the repo root (same keys as below; the script loads `.env` if the vars are not already set):

```bash
python scripts/seed_knowledge_base.py
```

- Files named `*.md` → visibility `both`
- `*.student.md` → `student`
- `*.admin.md` → `admin`

The script replaces all existing rows in `runa_knowledge_chunks` with freshly chunked content.

## 4. Wire the desktop app

1. Set `AI_LAMBDA_URL` in `python-service/service.py` to your AI Function URL.
2. If the Lambda uses `DEMO_SHARED_TOKEN`, set the sidecar’s API key header to match (see `aws/lambda/README.md` and existing `AI_LAMBDA_*` env notes).

The renderer sends optional **`useKnowledgeBase`** (default true) and **`kbTopK`** (1–12) on `POST /ai-task`; the sidecar forwards them to Lambda.

## 5. Deploy and verify

1. Deploy the updated `runa_ai_task_handler.py`.
2. Call the Function URL with a JSON body that includes `prompt`, `role`, and optionally `useKnowledgeBase` / `kbTopK`.
3. Confirm the response includes `ragCitations` when chunks match, and `ragUsed: true` when retrieval ran with at least one citation.

If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, the handler skips KB fetch and behaves like a plain chat completion (no error).

## 6. Operational notes

- **Row visibility** is enforced in Lambda with `visibility in (both, student)` or `(both, admin)` based on `role`.
- **RLS:** The migration does not enable RLS by default. For production, add policies so anon/authenticated roles cannot read `runa_knowledge_chunks`; keep access via service role on Lambda only.
- **Size:** The handler requests up to 800 rows per invocation; keep the table reasonably sized or add filters later.
