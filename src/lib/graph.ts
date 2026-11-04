export type Kind = 'current' | 'former' | 'group' | 'owns' | 'together' | 'mentionedPerson' | 'mentionedCompany';
export const KINDS: { k: Kind; label: string; hint: string; directed: boolean }[] = [
  { k: 'current', label: 'Samme virksomhed nu', hint: 'Personer med aktiv tilknytning til samme virksomhed', directed: false },
  { k: 'former', label: 'Har arbejdet i samme virksomhed', hint: 'Mindst én af dem har en afsluttet tilknytning til virksomheden', directed: false },
  { k: 'group', label: 'Samme organisation', hint: 'Personer i virksomheder under samme øverste ejer, fx forvaltninger i en kommune eller selskaber i en koncern', directed: false },
  { k: 'owns', label: 'Ejer/datterselskab (andet CVR)', hint: 'Ejerskab mellem selskaber i samme koncern. Viser hvilket selskab der ejer hvilket, også når de har forskelligt CVR-nummer', directed: false },
  { k: 'together', label: 'Deltog i samme aktivitet', hint: 'Aktiviteter med op til 12 deltagere', directed: false },
  { k: 'mentionedPerson', label: 'Har omtalt person', hint: 'Deltager i en aktivitet, hvor en anden person er omtalt', directed: true },
  { k: 'mentionedCompany', label: 'Har omtalt virksomhed', hint: 'Deltager i en aktivitet, hvor en virksomhed er omtalt', directed: true },
];

export type Raw = {
  persons: { id: string; name: string; company: string | null; rank: number | null; dm: boolean }[];
  companies: { id: string; name: string }[];
  affs: { contact_id: string; company_id: string; end_date: string | null }[];
  parts: { activity_id: string; contact_id: string }[];
  subjects: { activity_id: string; contact_id: string }[];
  acos: { activity_id: string; company_id: string }[];
  own: { owner_company_id: string; owned_company_id: string; is_main: boolean }[];
};
export type GNode = { id: string; type: 'p' | 'c'; ref: string; label: string; sub: string | null; dm: boolean; x?: number; y?: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };
export type GEdge = { id: string; kind: Kind; a: string; b: string; w: number; source: string | GNode; target: string | GNode };
export type Opts = { dmOnly: boolean; isolated: boolean; single?: boolean };

const group = <T,>(xs: T[], key: (x: T) => string) => { const m = new Map<string, T[]>(); for (const x of xs) { const k = key(x); const l = m.get(k); if (l) l.push(x); else m.set(k, [x]); } return m; };

export function buildGraph(raw: Raw, on: Record<Kind, boolean>, o: Opts): { nodes: GNode[]; edges: GEdge[] } {
  const person = new Map(raw.persons.filter((p) => !o.dmOnly || p.dm).map((p) => [p.id, p]));
  const comp = new Map(raw.companies.map((c) => [c.id, c.name]));
  const edges = new Map<string, GEdge>();
  const used = new Set<string>();
  const add = (kind: Kind, a: string, b: string, directed: boolean) => {
    const [x, y] = directed || a < b ? [a, b] : [b, a];
    const id = kind + '|' + x + '|' + y;
    const e = edges.get(id);
    if (e) e.w++; else edges.set(id, { id, kind, a: x, b: y, w: 1, source: x, target: y });
    used.add(x); used.add(y);
  };

  if (on.current || on.former) {
    for (const [cid, rows] of group(raw.affs.filter((a) => person.has(a.contact_id)), (a) => a.company_id)) {
      const kindOf = new Map<string, Kind>();
      for (const r of rows) {
        const k: Kind = r.end_date ? 'former' : 'current';
        if (!on[k]) continue;
        if (kindOf.get(r.contact_id) !== 'current') kindOf.set(r.contact_id, k);
      }
      if (kindOf.size < (o.single ? 1 : 2)) continue;
      for (const [pid, k] of kindOf) add(k, 'p:' + pid, 'c:' + cid, false);
    }
  }
  if (on.group || on.owns) {
    const up = new Map<string, string>();
    for (const o of raw.own) if (!up.has(o.owned_company_id) || o.is_main) up.set(o.owned_company_id, o.owner_company_id);
    const rootOf = (id: string) => { let c = id; const seen = new Set<string>([c]); while (up.has(c)) { const n = up.get(c)!; if (seen.has(n)) break; seen.add(n); c = n; } return c; };
    const inTree = new Set<string>(); for (const o of raw.own) { inTree.add(o.owner_company_id); inTree.add(o.owned_company_id); }
    const byRoot = new Map<string, { pid: string; cid: string }[]>();
    for (const a of raw.affs) {
      if (!person.has(a.contact_id) || !inTree.has(a.company_id)) continue;
      const r = rootOf(a.company_id); const l = byRoot.get(r); const row = { pid: a.contact_id, cid: a.company_id };
      if (l) l.push(row); else byRoot.set(r, [row]);
    }
    for (const [root, rows] of byRoot) {
      if (!o.single && (new Set(rows.map((r) => r.pid)).size < 2 || new Set(rows.map((r) => r.cid)).size < 2)) continue;
      if (on.group) for (const pid of new Set(rows.map((r) => r.pid))) add('group', 'p:' + pid, 'c:' + root, false);
      if (on.owns) {
        const done = new Set<string>();
        for (const cid of new Set(rows.map((r) => r.cid))) {
          let c = cid; const seen = new Set<string>([c]);
          while (up.has(c)) {
            const owner = up.get(c)!; if (seen.has(owner)) break; seen.add(owner);
            const key = owner + '>' + c;
            if (done.has(key)) break;
            done.add(key); add('owns', 'c:' + owner, 'c:' + c, true);
            c = owner;
          }
        }
      }
    }
  }
  const byAct = (xs: { activity_id: string; contact_id: string }[]) => group(xs.filter((x) => person.has(x.contact_id)), (x) => x.activity_id);
  const parts = byAct(raw.parts);
  if (on.together) {
    for (const rows of parts.values()) {
      const ids = [...new Set(rows.map((r) => r.contact_id))];
      if (ids.length < 2 || ids.length > 12) continue;
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) add('together', 'p:' + ids[i], 'p:' + ids[j], false);
    }
  }
  if (on.mentionedPerson) {
    const subs = byAct(raw.subjects);
    for (const [aid, ss] of subs) for (const p of new Set((parts.get(aid) ?? []).map((r) => r.contact_id))) for (const s of new Set(ss.map((r) => r.contact_id))) if (p !== s) add('mentionedPerson', 'p:' + p, 'p:' + s, true);
  }
  if (on.mentionedCompany) {
    const acs = group(raw.acos, (x) => x.activity_id);
    for (const [aid, cs] of acs) for (const p of new Set((parts.get(aid) ?? []).map((r) => r.contact_id))) for (const c of new Set(cs.map((r) => r.company_id))) add('mentionedCompany', 'p:' + p, 'c:' + c, true);
  }
  if (o.isolated) for (const id of person.keys()) used.add('p:' + id);

  const nodes: GNode[] = [];
  for (const id of used) {
    const ref = id.slice(2);
    if (id[0] === 'p') { const p = person.get(ref); if (p) nodes.push({ id, type: 'p', ref, label: p.name, sub: p.company, dm: p.dm }); }
    else nodes.push({ id, type: 'c', ref, label: comp.get(ref) ?? 'Virksomhed', sub: null, dm: false });
  }
  const ok = new Set(nodes.map((n) => n.id));
  return { nodes, edges: [...edges.values()].filter((e) => ok.has(e.a) && ok.has(e.b)) };
}
