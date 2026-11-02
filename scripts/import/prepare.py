"""Forbereder Excel-filen til import i PONTIFEX tertius. Skriver import.json og rapport.txt.
Brug: python3 prepare.py contacts.xlsx ud-mappe"""
import sys, json, re, uuid, datetime, collections
from urllib.parse import unquote
import openpyxl

src, out = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(src).active
raw = [r for r in ws.iter_rows(min_row=4, values_only=True) if r[1] or r[3]]
report = []

# ---- virksomheder ----
ALIAS = {
 'CLT Denmark': 'CLT DENMARK A/S', 'Henning Larsen Architects': 'Henning Larsen', 'INVIXO Consulting Group': 'INVIXO',
 'København Kommune': 'Københavns Kommune', 'Vilhelm Lauritzen (Kjær & Richter)': 'Vilhelm Lauritzen',
 'Werk': 'WERK Arkitekter', 'ak83 arkitekter a/s': 'AK83 Arkitekter', 'DOMINIA - en del af Thranek√¶r': 'DOMINIA - en del af Thranekær',
 'Cushman & Wakefield | RED': 'Cushman & Wakefield', 'Norconsult, Herlev': 'Norconsult',
}
FUND = {'Realdania', 'COWIfonden', 'Novo Nordisk Fonden', 'Dansk Arkitektur Center', 'Teknologisk Institut'}
ASSOC = {'DI Dansk Industri', 'FRI', 'LEDERNE', 'Ældre Sagen', 'UIA - The International Union of Architects', 'Bloxhub', 'Velliv Foreningen', 'Boligøkonomisk Videncenter'}
PE = {'HINES', 'Patrizia SE', 'Northern Horizon', 'NREP spin-off (navn ?)'}
PUBLIC = {'Bygningsstyrelsen', 'Region Hovedstaden', 'Københavns Kommune', 'Københavns Kommune, Teknik- og Miljøforvaltningen', 'DTU: Danmarks Tekniske Universitet',
          'SDU - Syddansk Universitet', 'AAU BUILD', 'Danmarks Nationalbank', 'EIFO', 'Copenhagen Capacity', 'The Danish Trade Council Riyadh'}
# Ejerskab efter bedste evne: (ejet, ejer, andel). Ikke verificeret mod CVR.
OWN = [
 ('COWI', 'COWIfonden'), ('CG Jensen', 'COWI'), ('PLH', 'Xpartners'),
 ('Novo Nordisk A/S', 'Novo Holdings A/S'), ('Novonesis', 'Novo Holdings A/S'), ('Novo Holdings A/S', 'Novo Nordisk Fonden'),
 ('NCC Property Development A/S', 'NCC Danmark'), ('NCC Danmark', 'NCC AB'),
 ('SKANSKA A/S', 'Skanska AB'), ('Skanska NO', 'Skanska AB'),
 ('Danica', 'Danske Bank'), ('Danica Ejendomme', 'Danica'), ('Danica Kapitalforvaltning K/S c/o Danica Pension', 'Danica'),
 ('Velliv Ejendomme A/S', 'VELLIV, PENSION & LIVSFORSIKRING A/S'), ('VELLIV, PENSION & LIVSFORSIKRING A/S', 'Velliv Foreningen'),
 ('Københavns Kommune, Teknik- og Miljøforvaltningen', 'Københavns Kommune'), ('DSB Ejendomsudvikling A/S', 'DSB'),
]
def canon(n):
    n = re.sub(r'\s+', ' ', n.strip()); return ALIAS.get(n, n)
def ctype(n):
    return 'foundation' if n in FUND else 'association' if n in ASSOC else 'pe_fund' if n in PE else 'public_body' if n in PUBLIC else 'company'

companies = {}
def comp(n):
    if n not in companies: companies[n] = {'id': str(uuid.uuid4()), 'name': n, 'type': ctype(n)}
    return companies[n]['id']
for r in raw:
    if r[5]: comp(canon(r[5]))
edges = []
for owned, owner in OWN:
    if owned in companies or owner in companies or True:
        a = comp(owned) if owned in companies else None
        if a is None: continue            # ejet findes ikke i filen: spring over
        edges.append({'owned': companies[owned]['id'], 'owner': comp(owner)})

# ---- niveau ud fra titel (bedste gæt, rettes manuelt) ----
def levels(t):
    if not t: return []
    s = t.lower(); out = []
    if re.search(r'bestyrelse|board member|\bboard\b', s): out.append('board')
    if re.search(r'\bceo\b|administrerende|adm\. direkt|managing director|founder|stifter|ejer\b|country manager', s): out.append('top')
    elif re.search(r'\bc[a-z]o\b|chief|executive|koncerndirekt|vice president|\bevp\b|\bsvp\b', s): out.append('executive')
    elif re.search(r'partner|direktør|director|\bvp\b|\bdirekt', s): out.append('director')
    elif re.search(r'\bhead of|chef|manager|markedschef|projektchef', s): out.append('manager')
    elif re.search(r'leder|\blead\b|team ?lead|afdelingsleder', s): out.append('lead')
    elif re.search(r'specialist|konsulent|consultant|arkitekt|architect|ingeniør|engineer|associate|coordinator|koordinator|analyst|advisor|rådgiver|projektleder|project manager', s): out.append('specialist')
    return out

# ---- personer, dedupe ----
def norm_li(u):
    if not u: return None
    u = unquote(u.strip()); return u
def clean(s):
    return re.sub(r'\s+', ' ', str(s)).strip() if s not in (None, '') else None
people = {}
def pkey(r): return ((clean(r[1]) or '').lower(), (clean(r[3]) or '').lower())
for r in raw:
    k = pkey(r); org = canon(r[5]) if r[5] else None
    email = clean(r[8]); email = email.lower() if email and '@' in email else None
    p = dict(first=clean(r[1]), middle=clean(r[2]), last=clean(r[3]), email=email, mobile=clean(r[9]), li=norm_li(clean(r[10])),
             title=clean(r[11]) if r[11] else None, notes=clean(r[12]) if r[12] else None, org=org,
             created=r[0].date().isoformat() if isinstance(r[0], datetime.datetime) else None,
             met=r[4] == 'TRUE', podcast=r[6] == 'TRUE', gohome=r[7] in ('TRUE', 'x'))
    if r[12]: p['notes'] = str(r[12]).strip()
    if k in people and (people[k]['org'] == org or not people[k]['org'] or not org):
        q = people[k]
        for f in ('middle', 'email', 'mobile', 'li', 'title', 'org'): q[f] = q[f] or p[f]
        if p['notes'] and p['notes'] not in (q['notes'] or ''): q['notes'] = ((q['notes'] + '\n') if q['notes'] else '') + p['notes']
        if p['created'] and (not q['created'] or p['created'] < q['created']): q['created'] = p['created']
        for f in ('met', 'podcast', 'gohome'): q[f] = q[f] or p[f]
        report.append(f"Sammenlagt dublet: {p['first']} {p['last']}")
    else:
        key = k if k not in people else k + (org or '',)
        if k in people: report.append(f"Samme navn, forskellig organisation, begge beholdt: {p['first']} {p['last']} ({people[k]['org']} / {org})")
        people[key] = p
seen_li, seen_em = {}, {}
for p in people.values():
    p['id'] = str(uuid.uuid4())
    if p['li']:
        n = re.sub(r'^https?://(www\.)?', '', p['li'].lower()).split('?')[0].rstrip('/')
        if n in seen_li: report.append(f"LinkedIn delt af to personer, fjernet på {p['first']} {p['last']}: {p['li']}"); p['li'] = None
        else: seen_li[n] = p['id']
    if p['email']:
        if p['email'] in seen_em: report.append(f"E-mail delt af to personer, beholdt hos første: {p['email']}")
        seen_em.setdefault(p['email'], p['id'])
    p['levels'] = levels(p['title'])
    p['labels'] = (['go_home_meeting'] if p['gohome'] else []) + (['climate_partnership'] if p['notes'] and 'Klimapartnerskab' in p['notes'] else [])
    if p['first'] and ('@' in p['first'] or ',' in p['first']) or not p['last']:
        report.append(f"Navn at tjekke: {p['first']!r} {p['last']!r}")
pl = list(people.values())
json.dump({'companies': list(companies.values()), 'edges': edges, 'people': pl}, open(out + '/import.json', 'w'), ensure_ascii=False)
report = [
  f"Personer: {len(pl)}  Virksomheder: {len(companies)}  Ejerskaber: {len(edges)}",
  f"Med e-mail: {sum(1 for p in pl if p['email'])}  Mobil: {sum(1 for p in pl if p['mobile'])}  LinkedIn: {sum(1 for p in pl if p['li'])}",
  f"Podcast: {sum(p['podcast'] for p in pl)}  Gå-hjem: {sum(p['gohome'] for p in pl)}  Klimapartnerskab: {sum('climate_partnership' in p['labels'] for p in pl)}",
  f"Mødt: {sum(p['met'] for p in pl)} (med dato {sum(1 for p in pl if p['met'] and p['created'])})",
  f"Uden organisation: {sum(1 for p in pl if not p['org'])}  Med niveau: {sum(1 for p in pl if p['levels'])}",
] + report
open(out + '/rapport.txt', 'w').write('\n'.join(report))
print('\n'.join(report))
