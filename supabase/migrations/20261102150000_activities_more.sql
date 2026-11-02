alter table public.activity add column if not exists owner_present boolean not null default true;
alter table public.activity add column if not exists location text;
insert into public.activity_type (code, name, sort_order, is_system) values
 ('coffee','Kaffemøde',1,false),('lunch','Frokost eller middag',3,false),('conference','Konference',4,false),
 ('event','Event eller reception',5,false),('visit','Besøg',6,false) on conflict (code) do nothing;
update public.activity_type set sort_order = case code when 'coffee' then 1 when 'meeting' then 2 when 'lunch' then 3 when 'conference' then 4 when 'event' then 5 when 'visit' then 6 when 'call' then 7 when 'email' then 8 when 'research' then 9 when 'news' then 10 when 'note' then 11 else sort_order end;
insert into public.company (name, is_own, type_id, created_by) select 'NIRAS', true, (select id from public.company_type where code='company'), 'f02b5830-1c44-43c8-ab2e-fa86f83b87d4' where not exists (select 1 from public.company where is_own);
