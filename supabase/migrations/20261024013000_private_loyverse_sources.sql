-- Read-only source ingestion; no POS writes or public financial access.
create table if not exists public.jbg_loyverse_raw (
 resource text not null, source_key text not null, raw jsonb not null,
 fetched_at timestamptz not null default now(), primary key(resource,source_key));
create table if not exists public.jbg_loyverse_pages (
 page_key text primary key, scope jsonb not null, raw jsonb not null,
 record_count integer not null check(record_count>=0),
 fetched_at timestamptz not null default now());
alter table public.jbg_loyverse_raw enable row level security;
alter table public.jbg_loyverse_pages enable row level security;
revoke all on public.jbg_loyverse_raw,public.jbg_loyverse_pages from public,anon,authenticated;
grant select,insert,update on public.jbg_loyverse_raw,public.jbg_loyverse_pages to service_role;
-- Deliberately no client RLS policies: service-role ingestion only.
