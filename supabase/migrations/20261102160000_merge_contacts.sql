-- Fletter to personer: alt flyttes til "keep", derefter slettes "drop". Kører med kalderens rettigheder.
create or replace function public.merge_contacts(keep uuid, drop_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare k public.contact; d public.contact; kr public.contact_relation; dr public.contact_relation; has_primary boolean;
begin
  if keep = drop_id then raise exception 'Vælg to forskellige personer'; end if;
  select * into k from public.contact where id = keep;
  select * into d from public.contact where id = drop_id;
  if k.id is null or d.id is null then raise exception 'Person ikke fundet'; end if;

  update public.contact set
    middle_name = coalesce(k.middle_name, d.middle_name),
    email = coalesce(k.email, d.email),
    phone = coalesce(k.phone, d.phone),
    linkedin_url = coalesce(k.linkedin_url, d.linkedin_url),
    active = k.active or d.active
  where id = keep;

  -- tilknytninger: slet dem der allerede findes hos keep, flyt resten
  delete from public.contact_company dc using public.contact_company kc
   where dc.contact_id = drop_id and kc.contact_id = keep and dc.company_id = kc.company_id
     and coalesce(dc.title,'') = coalesce(kc.title,'') and dc.end_date is not distinct from kc.end_date;
  select exists (select 1 from public.contact_company where contact_id = keep and is_primary) into has_primary;
  if has_primary then update public.contact_company set is_primary = false where contact_id = drop_id; end if;
  update public.contact_company set contact_id = keep where contact_id = drop_id;

  insert into public.contact_label (contact_id, label_id) select keep, label_id from public.contact_label where contact_id = drop_id on conflict do nothing;
  insert into public.activity_participant (activity_id, contact_id, company_id, note)
    select activity_id, keep, company_id, note from public.activity_participant where contact_id = drop_id on conflict do nothing;
  insert into public.activity_subject (activity_id, contact_id) select activity_id, keep from public.activity_subject where contact_id = drop_id on conflict do nothing;
  update public.company_relation set responsible_contact_id = keep where responsible_contact_id = drop_id;

  select * into kr from public.contact_relation where contact_id = keep and owner_id = auth.uid();
  select * into dr from public.contact_relation where contact_id = drop_id and owner_id = auth.uid();
  if dr.contact_id is not null then
    if kr.contact_id is null then
      update public.contact_relation set contact_id = keep where contact_id = drop_id and owner_id = auth.uid();
    else
      update public.contact_relation set
        mobile = coalesce(kr.mobile, dr.mobile),
        notes = nullif(concat_ws(E'\n\n', nullif(kr.notes,''), nullif(dr.notes,'')), ''),
        podcast_relevant = kr.podcast_relevant or dr.podcast_relevant,
        acquaintance_id = coalesce(kr.acquaintance_id, dr.acquaintance_id)
      where contact_id = keep and owner_id = auth.uid();
    end if;
  end if;

  delete from public.contact where id = drop_id;
end $$;
revoke all on function public.merge_contacts(uuid, uuid) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;
