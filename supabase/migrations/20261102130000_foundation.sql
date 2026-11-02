-- PONTIFEX tertius: samlet fundament. Skema, opslagslister, delt og privat lag, RLS, audit og views.
-- Alle hjælpefunktioner ligger i schema private, så de ikke kan kaldes via REST.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Brugere. Første bruger bliver ejer, alle senere er inaktive, til ejeren aktiverer dem. Selvtilmelding er slået fra i Auth.
create table public.app_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('owner','member')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_user where user_id = (select auth.uid()) and active)
$$;
create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_user where user_id = (select auth.uid()) and active and role = 'owner')
$$;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  select count(*) into n from public.app_user;
  insert into public.app_user (user_id, display_name, role, active)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email),
          case when n = 0 then 'owner' else 'member' end, n = 0);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- LinkedIn normaliseres: ingen protokol, ingen www eller sprogkode, ingen parametre, ingen afsluttende skråstreg.
create function private.normalize_linkedin(u text) returns text
language sql immutable set search_path = '' as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(btrim(u)), '^https?://', ''),
          '^(www|[a-z]{2})\.(linkedin\.com)', '\2'),
        '[?#].*$', ''),
      '/+$', ''),
    '')
$$;

create function private.touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create function private.lock_creator() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  return new;
end $$;

create function private.norm_contact() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.email := nullif(lower(btrim(new.email)), '');
  new.first_name := btrim(new.first_name);
  new.last_name := nullif(btrim(new.last_name), '');
  new.middle_name := nullif(btrim(new.middle_name), '');
  return new;
end $$;

-- Opslagslister. Medlemmer læser, ejeren udvider i Admin.
do $$
declare t text;
begin
  foreach t in array array['level','job_function','acquaintance','affiliation_type','sector','person_link_type',
                           'stage','activity_type','company_type'] loop
    execute format('create table public.%I (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null unique,
      sort_order int not null default 0,
      active boolean not null default true,
      is_system boolean not null default false)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_member())', t||'_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_owner())', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_owner()) with check (private.is_owner())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_owner() and not is_system)', t||'_del', t);
  end loop;
end $$;

-- Rang: sort_order 1 til 7 er rangen (1 højest). Labels uden rang (Bestyrelse) har is_ranked = false.
alter table public.level add column is_ranked boolean not null default true;

create table public.branch (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.branch(id) on delete restrict,
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  is_system boolean not null default false
);
create unique index branch_name_uq on public.branch (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.postcode (
  postal_code text primary key check (postal_code ~ '^[0-9]{4}$'),
  city text not null,
  municipality text,
  region text,
  region_ambiguous boolean not null default false
);

-- Delt lag
create table public.contact (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (btrim(first_name) <> ''),
  middle_name text,
  last_name text,
  email text check (email is null or position('@' in email) > 1),
  phone text,
  linkedin_url text,
  linkedin_norm text generated always as (private.normalize_linkedin(linkedin_url)) stored,
  active boolean not null default true,
  created_by uuid default auth.uid() references public.app_user(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index contact_linkedin_uq on public.contact (linkedin_norm) where linkedin_norm is not null;
create index contact_email_idx on public.contact (lower(email));
create index contact_name_idx on public.contact (lower(last_name), lower(first_name));

create table public.company (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  cvr text check (cvr is null or cvr ~ '^[0-9]{8}$'),
  website text,
  type_id uuid references public.company_type(id),
  sector_id uuid references public.sector(id),
  duns text,
  lei text,
  is_own boolean not null default false,
  active boolean not null default true,
  created_by uuid default auth.uid() references public.app_user(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index company_cvr_uq on public.company (cvr) where cvr is not null;
create index company_name_idx on public.company (lower(name));

create table public.company_location (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  name text,
  is_hq boolean not null default false,
  address text,
  postal_code text,
  city text,
  country char(2) not null default 'DK',
  lat numeric(9,6) check (lat is null or lat between -90 and 90),
  lng numeric(9,6) check (lng is null or lng between -180 and 180),
  active boolean not null default true,
  created_by uuid default auth.uid() references public.app_user(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index company_one_hq_uq on public.company_location (company_id) where is_hq;

-- Tilknytning mellem person og virksomhed. Titel er fritekst. Rang og labels ligger i contact_company_level.
create table public.contact_company (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contact(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete restrict,
  affiliation_type_id uuid not null references public.affiliation_type(id),
  title text,
  function_id uuid references public.job_function(id),
  location_id uuid,
  is_primary boolean not null default false,
  start_date date,
  end_date date,
  note text,
  created_by uuid default auth.uid() references public.app_user(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  foreign key (location_id, company_id) references public.company_location(id, company_id)
);
create unique index contact_one_primary_uq on public.contact_company (contact_id) where is_primary and end_date is null;
create index contact_company_company_idx on public.contact_company (company_id);

create table public.contact_company_level (
  contact_company_id uuid not null references public.contact_company(id) on delete cascade,
  level_id uuid not null references public.level(id),
  primary key (contact_company_id, level_id)
);

create table public.company_branch (
  company_id uuid not null references public.company(id) on delete cascade,
  branch_id uuid not null references public.branch(id),
  is_primary boolean not null default false,
  primary key (company_id, branch_id)
);
create unique index company_one_primary_branch_uq on public.company_branch (company_id) where is_primary;

-- Ejerskab. Ejeren peger på det ejede selskab. Hovedejeren er forælder i træet. Ejerandel kan være ukendt.
create table public.company_ownership (
  id uuid primary key default gen_random_uuid(),
  owner_company_id uuid not null references public.company(id) on delete cascade,
  owned_company_id uuid not null references public.company(id) on delete cascade,
  share_pct numeric(5,2) check (share_pct is null or (share_pct > 0 and share_pct <= 100)),
  is_main boolean not null default false,
  is_direct boolean not null default true,
  source text,
  checked_on date,
  note text,
  created_by uuid default auth.uid() references public.app_user(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_company_id <> owned_company_id),
  unique (owner_company_id, owned_company_id)
);
create unique index company_one_main_owner_uq on public.company_ownership (owned_company_id) where is_main;
create index company_ownership_owner_idx on public.company_ownership (owner_company_id);

create function private.no_ownership_cycle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    with recursive d(id) as (
      select o.owned_company_id from public.company_ownership o where o.owner_company_id = new.owned_company_id
      union
      select o.owned_company_id from public.company_ownership o join d on o.owner_company_id = d.id
    ) select 1 from d where id = new.owner_company_id
  ) then
    raise exception 'Ejerskabet ville skabe et kredsløb';
  end if;
  return new;
end $$;
create trigger company_ownership_cycle before insert or update on public.company_ownership
  for each row execute function private.no_ownership_cycle();

-- Privat lag (kun ejeren af rækken). Peger kun på delte rækker.
create table public.contact_relation (
  owner_id uuid not null default auth.uid() references public.app_user(user_id) on delete cascade,
  contact_id uuid not null references public.contact(id) on delete cascade,
  acquaintance_id uuid references public.acquaintance(id),
  acquainted_since date,
  no_invitation boolean not null default false,
  mobile text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, contact_id)
);

create table public.company_relation (
  owner_id uuid not null default auth.uid() references public.app_user(user_id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  stage_id uuid references public.stage(id),
  responsible_contact_id uuid references public.contact(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, company_id)
);

create table public.person_link (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_user(user_id) on delete cascade,
  contact_a uuid not null references public.contact(id) on delete cascade,
  contact_b uuid not null references public.contact(id) on delete cascade,
  type_id uuid not null references public.person_link_type(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_a <> contact_b),
  unique (owner_id, contact_a, contact_b, type_id)
);

-- Aktiviteter. Delt lag. Valgfrit 'private' gør aktiviteten usynlig for andre end skaberen.
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.activity_type(id),
  occurred_on date not null default current_date,
  title text not null check (btrim(title) <> ''),
  body text,
  source_url text,
  visibility text not null default 'shared' check (visibility in ('shared','private')),
  created_by uuid default auth.uid() references public.app_user(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_date_idx on public.activity (occurred_on desc);

create table public.activity_participant (
  activity_id uuid not null references public.activity(id) on delete cascade,
  contact_id uuid not null references public.contact(id) on delete cascade,
  company_id uuid references public.company(id) on delete set null,
  note text,
  primary key (activity_id, contact_id)
);
create index activity_participant_contact_idx on public.activity_participant (contact_id);
create index activity_participant_company_idx on public.activity_participant (company_id);

create table public.activity_company (
  activity_id uuid not null references public.activity(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  primary key (activity_id, company_id)
);
create index activity_company_company_idx on public.activity_company (company_id);

create table public.activity_subject (
  activity_id uuid not null references public.activity(id) on delete cascade,
  contact_id uuid not null references public.contact(id) on delete cascade,
  primary key (activity_id, contact_id)
);
create index activity_subject_contact_idx on public.activity_subject (contact_id);

create table public.activity_file (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity(id) on delete cascade,
  path text not null unique,
  file_name text not null,
  mime text,
  size_bytes bigint,
  created_by uuid default auth.uid() references public.app_user(user_id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_file_activity_idx on public.activity_file (activity_id);

create table public.activity_followup (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activity(id) on delete cascade,
  text text not null check (btrim(text) <> ''),
  due_on date,
  assigned_to uuid default auth.uid() references public.app_user(user_id) on delete set null,
  done_at timestamptz,
  created_by uuid default auth.uid() references public.app_user(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_followup_open_idx on public.activity_followup (due_on) where done_at is null;
create index activity_followup_act_idx on public.activity_followup (activity_id);

-- Triggere
do $$
declare t text;
begin
  foreach t in array array['contact','company','company_location','contact_company','company_ownership',
                           'contact_relation','company_relation','person_link','activity','activity_followup'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch()', t||'_touch', t);
  end loop;
  foreach t in array array['contact','company','company_location','contact_company','company_ownership','activity'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.lock_creator()', t||'_lock', t);
  end loop;
end $$;
create trigger contact_norm before insert or update on public.contact for each row execute function private.norm_contact();

-- RLS
alter table public.app_user enable row level security;
create policy app_user_read on public.app_user for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member());
create policy app_user_upd on public.app_user for update to authenticated
  using (private.is_owner()) with check (private.is_owner());
create policy app_user_del on public.app_user for delete to authenticated using (private.is_owner());

do $$
declare t text;
begin
  -- Delte tabeller med created_by: medlemmer læser og redigerer, sletter gør skaberen eller ejeren.
  foreach t in array array['contact','company','company_location','contact_company','company_ownership'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_member())', t||'_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_member() and created_by = (select auth.uid()))', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_member()) with check (private.is_member())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_owner() or (private.is_member() and created_by = (select auth.uid())))', t||'_del', t);
  end loop;
  -- Delte børnetabeller uden created_by
  foreach t in array array['company_branch','contact_company_level'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.is_member()) with check (private.is_member())', t||'_all', t);
  end loop;
  -- Referencedata
  foreach t in array array['branch','postcode'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_member())', t||'_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.is_owner()) with check (private.is_owner())', t||'_write', t);
  end loop;
  -- Privat lag
  foreach t in array array['contact_relation','company_relation','person_link'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.is_member() and owner_id = (select auth.uid())) with check (private.is_member() and owner_id = (select auth.uid()))', t||'_own', t);
  end loop;
  -- Aktivitetens børnetabeller følger aktivitetens synlighed via exists-underforespørgsel
  foreach t in array array['activity_participant','activity_company','activity_subject','activity_file','activity_followup'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.is_member() and exists (select 1 from public.activity a where a.id = activity_id)) with check (private.is_member() and exists (select 1 from public.activity a where a.id = activity_id))', t||'_all', t);
  end loop;
end $$;

alter table public.activity enable row level security;
create policy activity_read on public.activity for select to authenticated
  using (private.is_member() and (visibility = 'shared' or created_by = (select auth.uid())));
create policy activity_ins on public.activity for insert to authenticated
  with check (private.is_member() and created_by = (select auth.uid()));
create policy activity_upd on public.activity for update to authenticated
  using (private.is_member() and (visibility = 'shared' or created_by = (select auth.uid())))
  with check (private.is_member() and (visibility = 'shared' or created_by = (select auth.uid())));
create policy activity_del on public.activity for delete to authenticated
  using (private.is_owner() or (private.is_member() and created_by = (select auth.uid())));

-- Filer: privat lagerbøtte. Sti: <aktivitets-id>/<filnavn>. Adgang følger aktivitetens synlighed.
insert into storage.buckets (id, name, public, file_size_limit)
values ('activity-files', 'activity-files', false, 26214400)
on conflict (id) do nothing;
create policy activity_files_read on storage.objects for select to authenticated
  using (bucket_id = 'activity-files' and private.is_member()
         and exists (select 1 from public.activity a where a.id::text = (storage.foldername(name))[1]));
create policy activity_files_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-files' and private.is_member()
         and exists (select 1 from public.activity a where a.id::text = (storage.foldername(name))[1]));
create policy activity_files_del on storage.objects for delete to authenticated
  using (bucket_id = 'activity-files' and private.is_member()
         and exists (select 1 from public.activity a where a.id::text = (storage.foldername(name))[1]));

-- Audit-log: kun triggere skriver, kun ejeren læser.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  table_name text not null,
  row_id text,
  action text not null,
  old_row jsonb,
  new_row jsonb
);
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using (private.is_owner());
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb; o jsonb; n jsonb;
begin
  if tg_op = 'DELETE' then o := to_jsonb(old); j := o;
  elsif tg_op = 'INSERT' then n := to_jsonb(new); j := n;
  else o := to_jsonb(old); n := to_jsonb(new); j := n; end if;
  insert into public.audit_log (user_id, table_name, row_id, action, old_row, new_row)
  values ((select auth.uid()), tg_table_name,
          coalesce(j->>'id', concat_ws('/', j->>'activity_id', j->>'contact_id', j->>'company_id', j->>'branch_id',
                                        j->>'contact_company_id', j->>'level_id')),
          tg_op, o, n);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['contact','company','company_location','contact_company','contact_company_level','company_branch',
                           'company_ownership','activity','activity_participant','activity_company','activity_subject',
                           'activity_file','activity_followup'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()', t||'_audit', t);
  end loop;
end $$;

-- Views (kører med den kaldende brugers rettigheder)
create view public.v_contact_overview with (security_invoker = true) as
select c.id as contact_id, c.first_name, c.middle_name, c.last_name, c.email, c.phone, c.linkedin_url, c.active,
       cc.company_id, co.name as company_name,
       aff.name as affiliation_type, cc.title, fn.name as job_function,
       lab.labels, lab.rank, (lab.rank is not null and lab.rank <= 3) as is_decision_maker,
       coalesce(l.id, hq.id) as location_id,
       coalesce(l.city, hq.city) as city,
       coalesce(l.postal_code, hq.postal_code) as postal_code,
       pc.municipality, pc.region,
       (cc.location_id is null and hq.id is not null) as location_assumed
from public.contact c
left join public.contact_company cc on cc.contact_id = c.id and cc.is_primary and cc.end_date is null
left join public.company co on co.id = cc.company_id
left join public.affiliation_type aff on aff.id = cc.affiliation_type_id
left join public.job_function fn on fn.id = cc.function_id
left join public.company_location l on l.id = cc.location_id
left join public.company_location hq on hq.company_id = cc.company_id and hq.is_hq and cc.location_id is null
left join public.postcode pc on pc.postal_code = coalesce(l.postal_code, hq.postal_code)
left join lateral (
  select string_agg(lv.name, ', ' order by lv.sort_order) as labels,
         min(lv.sort_order) filter (where lv.is_ranked) as rank
  from public.contact_company a
  join public.contact_company_level x on x.contact_company_id = a.id
  join public.level lv on lv.id = x.level_id
  where a.contact_id = c.id and a.end_date is null
) lab on true;

create view public.v_company_overview with (security_invoker = true) as
select co.id as company_id, co.name, co.cvr, co.is_own, co.active,
       ty.name as company_type, s.name as sector,
       coalesce(pb.name, '') as primary_branch,
       hq.city as hq_city, hq.postal_code as hq_postal_code, pc.region,
       (select count(*) from public.contact_company cc where cc.company_id = co.id and cc.end_date is null) as current_contacts,
       mo.owner_company_id as parent_company_id, pa.name as parent_name,
       (select count(*) from public.company_ownership x where x.owner_company_id = co.id) as owned_count
from public.company co
left join public.company_type ty on ty.id = co.type_id
left join public.sector s on s.id = co.sector_id
left join public.company_branch cb on cb.company_id = co.id and cb.is_primary
left join public.branch pb on pb.id = cb.branch_id
left join public.company_location hq on hq.company_id = co.id and hq.is_hq
left join public.postcode pc on pc.postal_code = hq.postal_code
left join public.company_ownership mo on mo.owned_company_id = co.id and mo.is_main
left join public.company pa on pa.id = mo.owner_company_id;

-- Skemaoversigt til Admin-siden. Kun ejeren kan kalde den.
create function public.schema_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  if not private.is_owner() then raise exception 'Kun ejeren har adgang' using errcode = '42501'; end if;
  select jsonb_build_object('tables', coalesce(jsonb_agg(t order by t->>'name'), '[]'::jsonb)) into res
  from (
    select jsonb_build_object(
      'name', c.relname,
      'rows', (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')))[1]::text::int,
      'columns', (select jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'not_null', a.attnotnull,
                    'pk', coalesce(a.attnum = any (select unnest(i.indkey) from pg_index i where i.indrelid = c.oid and i.indisprimary), false)) order by a.attnum)
                  from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
      'fks', coalesce((select jsonb_agg(jsonb_build_object(
                    'columns', (select jsonb_agg(att.attname) from pg_attribute att where att.attrelid = k.conrelid and att.attnum = any (k.conkey)),
                    'ref_table', rc.relname,
                    'ref_columns', (select jsonb_agg(att.attname) from pg_attribute att where att.attrelid = k.confrelid and att.attnum = any (k.confkey))))
                  from pg_constraint k join pg_class rc on rc.oid = k.confrelid
                  where k.conrelid = c.oid and k.contype = 'f' and rc.relnamespace = 'public'::regnamespace), '[]'::jsonb)
    ) as t
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  ) s;
  return res;
end $$;
revoke execute on function public.schema_overview() from public, anon;
grant execute on function public.schema_overview() to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_member(), private.is_owner(), private.normalize_linkedin(text) to authenticated;
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Startdata til opslagslister. Ejeren kan udvide dem i Admin.
insert into public.level (code, name, sort_order, is_ranked, is_system) values
 ('top','Topleder',1,true,true),('executive','Direktion',2,true,true),('director','Direktør/VP',3,true,true),
 ('manager','Chef',4,true,true),('lead','Leder',5,true,true),('specialist','Specialist',6,true,true),
 ('other','Øvrig',7,true,true),('board','Bestyrelse',8,false,true);

insert into public.job_function (code, name, sort_order, is_system) values
 ('leadership','Ledelse',1,true),('project_execution','Projekt og udførelse',2,true),('development','Udvikling',3,true),
 ('bid','Tilbud og bid',4,true),('technical_advisory','Teknik og rådgivning',5,true),
 ('procurement_client','Indkøb og bygherre',6,true),('other','Andet',7,true);

insert into public.acquaintance (code, name, sort_order, is_system) values
 ('knows_of','Kender af',1,true),('met','Mødt',2,true),('knows','Kender',3,true),
 ('knows_well','Kender godt',4,true),('close','Tæt relation',5,true);

insert into public.affiliation_type (code, name, sort_order, is_system) values
 ('employment','Ansættelse',1,true),('board','Bestyrelse',2,true),('advisory_board','Advisory board',3,true),
 ('ownership','Ejerskab',4,true),('association','Forening eller udvalg',5,false),('freelance','Selvstændig rådgiver',6,false);

insert into public.sector (code, name, sort_order, is_system) values
 ('public','Offentlig',1,true),('private','Privat',2,true),('housing','Almennyttig',3,true);

insert into public.company_type (code, name, sort_order, is_system) values
 ('company','Selskab',1,true),('foundation','Fond',2,true),('association','Forening',3,true),
 ('pe_fund','Kapitalfond',4,true),('public_body','Offentlig enhed',5,true);

insert into public.person_link_type (code, name, sort_order, is_system) values
 ('colleague','Kollega',1,true),('former_colleague','Tidligere kollega',2,true),
 ('reports_to','Rapporterer til',3,true),('collaborator','Samarbejdspartner',4,true),('mentor','Mentor',5,true);

insert into public.stage (code, name, sort_order, is_system) values
 ('unknown','Ukendt',1,false),('known','Kendt',2,false),('dialogue','I dialog',3,false),
 ('active','Aktiv relation',4,false),('strategic','Strategisk',5,false);

insert into public.activity_type (code, name, sort_order, is_system) values
 ('meeting','Møde',1,true),('call','Opkald',2,true),('email','Mail',3,true),
 ('research','Research',4,true),('news','Nyhed',5,true),('note','Note',6,true);

insert into public.branch (code, name, sort_order, is_system) values
 ('contractor','Entreprenør',1,true),('client','Bygherre',2,true),('architect','Arkitekt',3,true),
 ('engineer','Ingeniør',4,true),('lawyer','Advokat',5,true);

insert into public.branch (parent_id, code, name, sort_order, is_system)
select p.id, v.code, v.name, v.ord, true
from (values
 ('client','state','Stat',1),('client','region','Region',2),('client','municipality','Kommune',3),
 ('client','housing_assoc','Almen bolig',4),('client','investor','Investor og ejendomsselskab',5),
 ('client','pension','Pensionskasse',6),('client','foundation','Fond',7),('client','developer','Privat udvikler',8)
) as v(parent_code, code, name, ord)
join public.branch p on p.code = v.parent_code;
