-- Labels (opslagsliste, kan udvides af alle medlemmer), kobling til personer og podcast-relevans på den private relation.
create table public.label (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null unique,
  sort_order int not null default 0, active boolean not null default true, is_system boolean not null default false);
alter table public.label enable row level security;
create policy label_read on public.label for select to authenticated using (private.is_member());
create policy label_ins on public.label for insert to authenticated with check (private.is_member());
create policy label_upd on public.label for update to authenticated using (private.is_member()) with check (private.is_member());
create policy label_del on public.label for delete to authenticated using (private.is_owner() and not is_system);
create table public.contact_label (
  contact_id uuid not null references public.contact(id) on delete cascade,
  label_id uuid not null references public.label(id) on delete cascade, primary key (contact_id, label_id));
create index contact_label_label_idx on public.contact_label (label_id);
alter table public.contact_label enable row level security;
create policy contact_label_all on public.contact_label for all to authenticated using (private.is_member()) with check (private.is_member());
alter table public.contact_relation add column podcast_relevant boolean not null default false;
insert into public.label (code, name, sort_order) values ('go_home_meeting','Gå-hjem-møder',1),('seasonal_greeting','Seasonal greeting',2),('climate_partnership','Klimapartnerskab',3);
