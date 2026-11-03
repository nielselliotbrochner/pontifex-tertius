-- Rating af arkitekter og entreprenører (heatmap). Værdi: 2 = ja, 1 = delvis, 0 = nej, null = vurderet uden svar. Ingen række = ikke vurderet.
create table public.rating_criterion (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null check (category in ('entreprenor','arkitekt')),
  grp text not null,
  name text not null,
  shared_key text,
  sort_order int not null default 0,
  active boolean not null default true
);
create table public.company_rating (
  company_id uuid not null references public.company(id) on delete cascade,
  criterion_id uuid not null references public.rating_criterion(id) on delete cascade,
  value smallint check (value between 0 and 2),
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (company_id, criterion_id)
);
create index company_rating_criterion_idx on public.company_rating(criterion_id);
alter table public.rating_criterion enable row level security;
alter table public.company_rating enable row level security;
create policy rating_criterion_read on public.rating_criterion for select using (private.is_member());
create policy rating_criterion_ins on public.rating_criterion for insert with check (private.is_owner());
create policy rating_criterion_upd on public.rating_criterion for update using (private.is_owner()) with check (private.is_owner());
create policy rating_criterion_del on public.rating_criterion for delete using (private.is_owner());
create policy company_rating_all on public.company_rating for all using (private.is_member()) with check (private.is_member());
insert into public.rating_criterion(key,category,grp,name,shared_key,sort_order) values
('ent_renovering','entreprenor','segment','Renovering',null,1),
('ent_skoler','entreprenor','segment','Skoler og uddannelse','skoler',2),
('ent_idraet','entreprenor','segment','Idræt','idraet',3),
('ent_kultur','entreprenor','segment','Kultur','kultur',4),
('ent_boliger_private','entreprenor','segment','Boliger (private)','boliger_private',5),
('ent_boliger_almene','entreprenor','segment','Boliger (almene)','boliger_almene',6),
('ent_kontor','entreprenor','segment','Kontor','kontor',7),
('ent_laboratorier','entreprenor','segment','Laboratorier','laboratorier',8),
('ent_fredede','entreprenor','segment','Fredede bygninger','fredede',9),
('ent_hospitaler','entreprenor','segment','Hospitaler og sundhed','hospitaler',10),
('ent_industri_farma','entreprenor','segment','Industri og farma','industri_farma',11),
('ent_butikker','entreprenor','segment','Butikker','butikker',12),
('ent_hoteller','entreprenor','segment','Hoteller','hoteller',13),
('ent_totalentreprise','entreprenor','udbudsform','Totalentreprise',null,14),
('ent_sum_u50','entreprenor','byggesum','Under 50 mio. kr.',null,15),
('ent_sum_50_100','entreprenor','byggesum','50-100 mio. kr.',null,16),
('ent_sum_100_250','entreprenor','byggesum','100-250 mio. kr.',null,17),
('ent_sum_250_500','entreprenor','byggesum','250-500 mio. kr.',null,18),
('ent_sum_o500','entreprenor','byggesum','Over 500 mio. kr.',null,19),
('ark_institutioner','arkitekt','segment','Institutioner',null,1),
('ark_skoler','arkitekt','segment','Skoler og uddannelse','skoler',2),
('ark_idraet','arkitekt','segment','Idræt','idraet',3),
('ark_kultur','arkitekt','segment','Kultur','kultur',4),
('ark_boliger_private','arkitekt','segment','Boliger (private)','boliger_private',5),
('ark_boliger_almene','arkitekt','segment','Boliger (almene)','boliger_almene',6),
('ark_kontor','arkitekt','segment','Kontor','kontor',7),
('ark_kontorindretning','arkitekt','segment','Kontorindretning',null,8),
('ark_fredede','arkitekt','segment','Fredede bygninger','fredede',9),
('ark_hospitaler','arkitekt','segment','Hospitaler og sundhed','hospitaler',10),
('ark_laboratorier','arkitekt','segment','Laboratorier','laboratorier',11),
('ark_industri_farma','arkitekt','segment','Industri og farma','industri_farma',12),
('ark_butikker','arkitekt','segment','Butikker','butikker',13),
('ark_hoteller','arkitekt','segment','Hoteller','hoteller',14),
('ark_planlaegning','arkitekt','segment','Planlægning',null,15),
('ark_landskab','arkitekt','segment','Landskab',null,16),
('ark_forsyningsbyggeri','arkitekt','segment','Forsyningsbyggeri',null,17);
