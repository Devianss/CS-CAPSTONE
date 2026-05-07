-- RUNA small RAG knowledge base (text chunks; retrieval in AI Lambda).
-- Service-role (Lambda) bypasses RLS for reads/writes.

create table if not exists public.runa_knowledge_chunks (
  id bigint generated always as identity primary key,
  source text not null,
  title text not null default '',
  content text not null,
  chunk_index int not null default 0,
  visibility text not null default 'both'
    check (visibility in ('student', 'admin', 'both')),
  created_at timestamptz not null default now()
);

create index if not exists idx_runa_knowledge_chunks_visibility
  on public.runa_knowledge_chunks (visibility);

comment on table public.runa_knowledge_chunks is 'Bounded RAG chunks for Runa assistant; retrieved server-side only.';
comment on column public.runa_knowledge_chunks.visibility is 'student | admin | both — filters which roles may receive this chunk.';
