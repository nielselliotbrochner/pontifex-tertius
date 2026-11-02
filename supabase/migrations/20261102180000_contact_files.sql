create table public.contact_file (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contact(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.app_user(user_id) on delete cascade,
  path text not null unique,
  file_name text not null,
  mime text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index contact_file_contact_idx on public.contact_file (contact_id);
alter table public.contact_file enable row level security;
create policy contact_file_own on public.contact_file for all to authenticated
  using (private.is_member() and owner_id = (select auth.uid()))
  with check (private.is_member() and owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit)
values ('contact-files', 'contact-files', false, 26214400)
on conflict (id) do nothing;

-- Filer på personer er private: første mappe i stien er ejerens bruger-id.
create policy contact_files_read on storage.objects for select to authenticated
  using (bucket_id = 'contact-files' and private.is_member() and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy contact_files_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'contact-files' and private.is_member() and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy contact_files_del on storage.objects for delete to authenticated
  using (bucket_id = 'contact-files' and private.is_member() and (storage.foldername(name))[1] = (select auth.uid())::text);
