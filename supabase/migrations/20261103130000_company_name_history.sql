-- Tidligere virksomhedsnavne (samme CVR, nyt navn). Virksomhedsposten har altid det nuværende navn.
create table public.company_name_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  valid_from date,
  valid_to date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (valid_from is null or valid_to is null or valid_from <= valid_to)
);
create index company_name_history_company_idx on public.company_name_history(company_id);
create index company_name_history_name_idx on public.company_name_history(lower(name));
alter table public.company_name_history enable row level security;
create policy company_name_history_all on public.company_name_history for all to authenticated using (private.is_member()) with check (private.is_member());
create trigger company_name_history_audit after insert or update or delete on public.company_name_history for each row execute function private.audit();
