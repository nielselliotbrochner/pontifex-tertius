"""Laver SQL-filer ud fra import.json. Brug: python3 mksql.py import.json ud-mappe ejer-uuid"""
import json, sys, uuid
src, out, owner = sys.argv[1:4]
d = json.load(open(src))
def lit(o): return "$j$" + json.dumps(o, ensure_ascii=False, separators=(',', ':')) + "$j$"
cos = [[c['name'], c['type']] for c in d['companies']]
open(out + '/sql0.sql', 'w').write(f"""
insert into public.company (name, type_id, created_by)
select x.n, (select id from public.company_type where code = x.t), '{owner}'
from jsonb_to_recordset({lit([{'n': n, 't': t} for n, t in cos])}::jsonb) as x(n text, t text);
insert into public.company_ownership (owner_company_id, owned_company_id, is_main, source, created_by)
select o.id, w.id, true, 'Importforslag, ikke verificeret mod CVR', '{owner}'
from jsonb_to_recordset({lit([{'o': next(c['name'] for c in d['companies'] if c['id'] == e['owner']), 'w': next(c['name'] for c in d['companies'] if c['id'] == e['owned'])} for e in d['edges']])}::jsonb) as x(o text, w text)
join public.company o on o.name = x.o join public.company w on w.name = x.w;
""")
ppl = []
for p in d['people']:
    r = {'f': p['first'], 'm': p['middle'], 'l': p['last'], 'e': p['email'], 'li': p['li'], 'mo': p['mobile'], 'nt': p['notes'], 'c': p['org'], 't': p['title'], 'd': p['created']}
    if p['podcast']: r['po'] = True
    if p['met']: r['mt'] = True
    if p['levels']: r['lv'] = p['levels']
    if p['labels']: r['lb'] = p['labels']
    ppl.append({k: v for k, v in r.items() if v is not None})
n = 4; size = (len(ppl) + n - 1) // n
for k in range(n):
    chunk = ppl[k * size:(k + 1) * size]
    open(out + f'/sql{k+1}.sql', 'w').write(f"""
with src as (select gen_random_uuid() as i, case when x.mt then gen_random_uuid() end as a, x.* from jsonb_to_recordset({lit(chunk)}::jsonb)
    as x(f text, m text, l text, e text, li text, mo text, nt text, po bool, mt bool, c text, t text, lv text[], lb text[], d date)),
c1 as (insert into public.contact (id, first_name, middle_name, last_name, email, linkedin_url, created_by) select i, f, m, l, e, li, '{owner}' from src),
c2 as (insert into public.contact_relation (owner_id, contact_id, mobile, notes, podcast_relevant) select '{owner}', i, mo, nt, coalesce(po,false) from src where mo is not null or nt is not null or po),
c3 as (insert into public.contact_company (contact_id, company_id, affiliation_type_id, title, is_primary, created_by)
  select src.i, co.id, (select id from public.affiliation_type where code='employment'), src.t, true, '{owner}' from src join public.company co on co.name = src.c returning id, contact_id),
c4 as (insert into public.contact_company_level (contact_company_id, level_id)
  select c3.id, lv.id from c3 join src on src.i = c3.contact_id cross join lateral unnest(src.lv) u(code) join public.level lv on lv.code = u.code),
c5 as (insert into public.contact_label (contact_id, label_id) select src.i, l.id from src cross join lateral unnest(src.lb) u(code) join public.label l on l.code = u.code),
c6 as (insert into public.activity (id, type_id, occurred_on, title, created_by)
  select a, (select id from public.activity_type where code='note'), coalesce(d, current_date), 'Mødt eller kommunikeret med (importeret)', '{owner}' from src where a is not null)
insert into public.activity_participant (activity_id, contact_id, company_id) select src.a, src.i, co.id from src left join public.company co on co.name = src.c where src.a is not null;
""")
import os
for f in sorted(os.listdir(out)):
    if f.startswith('sql') and f.endswith('.sql'): print(f, os.path.getsize(out + '/' + f))
