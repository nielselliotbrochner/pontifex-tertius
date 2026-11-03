import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { Link, Empty, Err, fullName } from '../lib/ui';
import { useLookups } from '../lib/lookups';
import { fetchAll } from '../lib/fetchAll';

type Row = { podcast?: boolean; label_ids?: string[]; contact_id: string; first_name: string; middle_name: string | null; last_name: string | null; email: string | null; company_name: string | null;
  title: string | null; labels: string | null; rank: number | null; is_decision_maker: boolean | null; city: string | null; start_date: string | null };

const SORTS = ['rank', 'first', 'last', 'company', 'title'] as const;
type SortKey = (typeof SORTS)[number];

export default function Persons() {
  const { data, error, loading } = useAsync(async () => {
    const base = await fetchAll<Row>((f, t) => supabase.from('v_contact_overview').select('contact_id,first_name,middle_name,last_name,email,company_name,title,labels,rank,is_decision_maker,city,start_date').eq('active', true).order('contact_id').range(f, t));
    const [pod, lab] = await Promise.all([
      supabase.from('contact_relation').select('contact_id').eq('podcast_relevant', true).limit(5000),
      supabase.from('contact_label').select('contact_id,label_id').limit(20000),
    ]);
    const podSet = new Set((pod.data ?? []).map((x: { contact_id: string }) => x.contact_id));
    const labs = new Map<string, string[]>();
    (lab.data ?? []).forEach((x: { contact_id: string; label_id: string }) => labs.set(x.contact_id, [...(labs.get(x.contact_id) ?? []), x.label_id]));
    return base.map((x) => ({ ...x, podcast: podSet.has(x.contact_id), label_ids: labs.get(x.contact_id) ?? [] }));
  }, [], 'persons');
  const lk = useLookups();
  const [pc, setPc] = useState(false);
  const [lbl, setLbl] = useState('');
  const [q, setQ] = useState('');
  const [dm, setDm] = useState(false);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r) => (!dm || r.is_decision_maker) && (!pc || r.podcast) && (!lbl || r.label_ids?.includes(lbl)) &&
      (!s || [fullName(r), r.company_name, r.title, r.email, r.city].some((x) => x?.toLowerCase().includes(s))));
  }, [data, q, dm, pc, lbl]);
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>(() => { try { const v = JSON.parse(localStorage.getItem('personsort') || ''); if (v && SORTS.includes(v.k)) return v; } catch { /* ignoreres */ } return { k: 'last', d: 1 }; });
  const sorted = useMemo(() => {
    const col = new Intl.Collator('sv', { sensitivity: 'base', numeric: true });
    const val = (r: Row): string | number | null => sort.k === 'rank' ? r.rank : sort.k === 'first' ? [r.first_name, r.middle_name].filter(Boolean).join(' ') : sort.k === 'last' ? r.last_name : sort.k === 'company' ? r.company_name : r.title;
    const cmp = (a: string | number | null, b: string | number | null) => (typeof a === 'number' && typeof b === 'number' ? a - b : col.compare(String(a), String(b)));
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b); const xe = x === null || x === '', ye = y === null || y === '';
      if (xe !== ye) return xe ? 1 : -1; // tomme felter altid nederst
      const c = xe ? 0 : cmp(x, y) * sort.d;
      return c || col.compare(a.last_name ?? '', b.last_name ?? '') || col.compare(a.first_name, b.first_name);
    });
  }, [rows, sort]);
  const by = (k: SortKey) => { const n = { k, d: (sort.k === k ? -sort.d : 1) as 1 | -1 }; setSort(n); try { localStorage.setItem('personsort', JSON.stringify(n)); } catch { /* ignoreres */ } };
  const th = (k: SortKey, label: string, cls?: string) => (
    <th className={cls} aria-sort={sort.k === k ? (sort.d === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className={'sortbtn' + (sort.k === k ? ' on' : '')} onClick={() => by(k)}>{label}<span aria-hidden="true">{sort.k === k ? (sort.d === 1 ? ' ▲' : ' ▼') : ''}</span></button>
    </th>);
  const total = data?.length ?? 0;
  const dms = (data ?? []).filter((r) => r.is_decision_maker).length;
  return (
    <>
      <h1>Personer</h1>
      <div className="kpis">
        <div><b>{total}</b><span>personer</span></div>
        <div><b>{dms}</b><span>beslutningstagere</span></div>
        <div><b>{(data ?? []).filter((r) => r.podcast).length}</b><span>relevante for podcast</span></div>
      </div>
      <div className="bar">
        <input className="grow" type="search" placeholder="Søg navn, virksomhed, titel, by" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Søg" />
        <label className="check"><input type="checkbox" checked={dm} onChange={(e) => setDm(e.target.checked)} /> Kun beslutningstagere</label>
        <label className="check"><input type="checkbox" checked={pc} onChange={(e) => setPc(e.target.checked)} /> Podcast</label>
        <select value={lbl} onChange={(e) => setLbl(e.target.value)} aria-label="Label"><option value="">Alle labels</option>{lk.data?.label.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <Link view="person-ny" className="btn">Ny person</Link>
      </div>
      <Err msg={error} />
      {!loading && total === 0 && !error && <Empty title="Ingen personer endnu" text="Opret den første, eller importer din Excel-fil." />}
      {rows.length > 0 && (
        <table className="ptable">
          <thead><tr>{th('rank', 'Rang', 'num')}{th('first', 'Fornavn')}{th('last', 'Efternavn')}{th('company', 'Virksomhed')}{th('title', 'Titel', 'hide-s')}<th className="hide-s">By</th></tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.contact_id}>
                <td className="num"><span className="rank">{r.rank ?? ''}</span></td>
                <td><Link view="person" id={r.contact_id}>{[r.first_name, r.middle_name].filter(Boolean).join(' ')}</Link></td>
                <td><Link view="person" id={r.contact_id}>{r.last_name}</Link>{r.is_decision_maker && <> <span className="dm" title="Beslutningstager">B</span></>}</td>
                <td>{r.company_name ?? <span className="mute">Ingen tilknytning</span>}<div className="mute show-s">{r.title}</div>{r.labels && <div className="hide-s">{r.labels.split(', ').map((l) => <span className="tag" key={l}>{l}</span>)}</div>}</td>
                <td className="hide-s">{r.title}{r.start_date && <div className="mute">siden {r.start_date.slice(0, 4)}</div>}</td>
                <td className="hide-s">{r.city}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {loading && <p className="mute">Henter</p>}
    </>
  );
}
