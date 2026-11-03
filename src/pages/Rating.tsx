import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { fetchAll } from '../lib/fetchAll';
import { Link, Empty, Err } from '../lib/ui';
import { CompanyPick, findCompany, useCompanyOpts } from '../lib/CompanyPick';

type Cat = 'arkitekt' | 'entreprenor';
const CATS: { k: Cat; label: string; branch: string }[] = [{ k: 'arkitekt', label: 'Arkitekt', branch: 'architect' }, { k: 'entreprenor', label: 'Entreprenør', branch: 'contractor' }];
type Crit = { id: string; key: string; category: Cat; grp: string; name: string; sort_order: number };
type Val = 0 | 1 | 2 | null;
const GRP: Record<string, string> = { segment: 'Segment', udbudsform: 'Udbudsform', byggesum: 'Byggesum' };
const SYM = (v: Val | undefined) => (v === undefined ? '' : v === null ? '?' : String(v));
const NEXT = (v: Val | undefined): Val | undefined => (v === undefined ? 2 : v === 2 ? 1 : v === 1 ? 0 : v === 0 ? null : undefined);
const LABEL = (v: Val | undefined) => (v === undefined ? 'Ikke vurderet' : v === null ? 'Vurderet uden svar' : v === 2 ? 'Ja' : v === 1 ? 'Delvis' : 'Nej');

export default function Rating() {
  const [cat, setCat] = useState<Cat>('arkitekt');
  const [q, setQ] = useState('');
  const [need, setNeed] = useState<string[]>([]); const [min, setMin] = useState<1 | 2>(1);
  const [grpOff, setGrpOff] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]); const [add, setAdd] = useState('');
  const [sort, setSort] = useState<'name' | 'score'>('name');
  const [local, setLocal] = useState<Record<string, Val | undefined>>({});
  const [err, setErr] = useState<string | null>(null);
  const opts = useCompanyOpts();

  const { data, error, loading } = useAsync(async () => {
    const [cr, br, cb, co] = await Promise.all([
      supabase.from('rating_criterion').select('id,key,category,grp,name,sort_order').eq('active', true).order('sort_order'),
      supabase.from('branch').select('id,code').in('code', CATS.map((c) => c.branch)),
      fetchAll<{ company_id: string; branch_id: string }>((f, t) => supabase.from('company_branch').select('company_id,branch_id').order('company_id').order('branch_id').range(f, t)),
      fetchAll<{ id: string; name: string }>((f, t) => supabase.from('company').select('id,name').eq('active', true).order('name').order('id').range(f, t)),
    ]);
    if (cr.error) throw cr.error; if (br.error) throw br.error;
    const rt = await fetchAll<{ company_id: string; criterion_id: string; value: Val }>((f, t) => supabase.from('company_rating').select('company_id,criterion_id,value').order('company_id').order('criterion_id').range(f, t));
    return { crit: cr.data as Crit[], branches: br.data as { id: string; code: string }[], cb, names: new Map(co.map((c) => [c.id, c.name])), rt };
  }, [], 'rating');

  const view = useMemo(() => {
    if (!data) return null;
    const crit = data.crit.filter((c) => c.category === cat);
    const ids = new Set(crit.map((c) => c.id));
    const bid = data.branches.find((b) => b.code === CATS.find((c) => c.k === cat)!.branch)?.id;
    const val = new Map<string, Val>(); for (const r of data.rt) if (ids.has(r.criterion_id)) val.set(r.company_id + '|' + r.criterion_id, r.value);
    const cos = new Set<string>(extra);
    for (const x of data.cb) if (x.branch_id === bid) cos.add(x.company_id);
    for (const r of data.rt) if (ids.has(r.criterion_id)) cos.add(r.company_id);
    return { crit, val, cos: [...cos] };
  }, [data, cat, extra]);

  const get = (c: string, k: string): Val | undefined => { const key = c + '|' + k; if (key in local) return local[key]; return view?.val.has(key) ? view.val.get(key) : undefined; };
  const cols = (view?.crit ?? []).filter((c) => !grpOff.includes(c.grp));
  const groups = [...new Set((view?.crit ?? []).map((c) => c.grp))];

  const rows = useMemo(() => {
    if (!view || !data) return [];
    const s = q.trim().toLowerCase();
    const list = view.cos.map((id) => {
      let score = 0;
      for (const c of cols) { const v = get(id, c.id); if (typeof v === 'number') score += v; }
      return { id, name: data.names.get(id) ?? '?', score };
    }).filter((r) => (!s || r.name.toLowerCase().includes(s)) && need.every((k) => { const v = get(r.id, k); return typeof v === 'number' && v >= min; }));
    return list.sort((a, b) => (sort === 'score' ? b.score - a.score || a.name.localeCompare(b.name, 'da') : a.name.localeCompare(b.name, 'da')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, data, q, need, min, sort, local, grpOff]);

  async function cycle(company: string, k: string) {
    const nv = NEXT(get(company, k)); const key = company + '|' + k;
    setLocal((x) => ({ ...x, [key]: nv })); setErr(null);
    const r = nv === undefined
      ? await supabase.from('company_rating').delete().eq('company_id', company).eq('criterion_id', k)
      : await supabase.from('company_rating').upsert({ company_id: company, criterion_id: k, value: nv, updated_at: new Date().toISOString() }, { onConflict: 'company_id,criterion_id' });
    if (r.error) { setErr(r.error.message); setLocal((x) => { const y = { ...x }; delete y[key]; return y; }); }
  }
  function addCompany() {
    const c = opts.data ? findCompany(opts.data, add) : undefined;
    if (!c) { setErr('Vælg en eksisterende virksomhed fra listen.'); return; }
    setErr(null); setExtra((x) => (x.includes(c.id) ? x : [...x, c.id])); setAdd('');
  }
  const toggle = (arr: string[], set: (v: string[]) => void, k: string) => set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const yes = (k: string) => rows.filter((r) => get(r.id, k) === 2).length;

  return (
    <>
      <h1>Rating</h1>
      <p className="sub">Vurdér arkitekter og entreprenører på segment, udbudsform og byggesum. Klik i en celle for at skifte: Ja (2), Delvis (1), Nej (0), ? (vurderet uden svar), tom (ikke vurderet).</p>
      <div className="bar" role="group" aria-label="Kategori">
        {CATS.map((c) => <button key={c.k} className={'btn sm ' + (cat === c.k ? '' : 'ghost')} aria-pressed={cat === c.k} onClick={() => { setCat(c.k); setNeed([]); setGrpOff([]); }}>{c.label}</button>)}
        <input className="grow" type="search" placeholder="Søg virksomhed" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Søg" />
      </div>
      <div className="bar">
        <span className="mono mute">Vis</span>
        {groups.map((g) => <button key={g} className={'btn sm ' + (grpOff.includes(g) ? 'ghost' : '')} aria-pressed={!grpOff.includes(g)} onClick={() => toggle(grpOff, setGrpOff, g)}>{GRP[g] ?? g}</button>)}
        <span className="mono mute">Sortér</span>
        <button className={'btn sm ' + (sort === 'name' ? '' : 'ghost')} onClick={() => setSort('name')}>Navn</button>
        <button className={'btn sm ' + (sort === 'score' ? '' : 'ghost')} onClick={() => setSort('score')}>Score</button>
      </div>
      <div className="bar">
        <CompanyPick value={add} onChange={setAdd} options={opts.data ?? []} listId="rating-add" />
        <button className="btn ghost sm" onClick={addCompany}>Tilføj virksomhed til oversigten</button>
      </div>
      <div className="bar">
        <span className="mono mute">Skal kunne</span>
        <span className="mute">{need.length ? need.map((k) => view?.crit.find((c) => c.id === k)?.name).join(', ') : 'Klik på en kolonneoverskrift for at filtrere'}</span>
        {need.length > 0 && <>
          <select value={min} onChange={(e) => setMin(Number(e.target.value) as 1 | 2)} aria-label="Mindst"><option value={1}>Mindst delvis</option><option value={2}>Kun ja</option></select>
          <button className="btn ghost sm" onClick={() => setNeed([])}>Nulstil</button>
        </>}
      </div>
      <ul className="hmlegend" aria-label="Forklaring">
        <li><i className="hm hm2">2</i> Ja</li><li><i className="hm hm1">1</i> Delvis</li><li><i className="hm hm0">0</i> Nej</li><li><i className="hm hmq">?</i> Uden svar</li><li><i className="hm hmn" /> Ikke vurderet</li>
      </ul>
      <Err msg={error ?? err} />
      {!loading && view && rows.length === 0 && !error && <Empty title="Ingen virksomheder" text="Sæt branchen Arkitekt eller Entreprenør på virksomhederne, eller tilføj en virksomhed ovenfor." />}
      {rows.length > 0 && (
        <div className="hmwrap">
          <table className="hmtable">
            <thead>
              <tr>
                <th className="hmname" rowSpan={2}>Virksomhed ({rows.length})</th>
                {groups.filter((g) => !grpOff.includes(g)).map((g) => <th key={g} className="hmgrp" colSpan={cols.filter((c) => c.grp === g).length}>{GRP[g] ?? g}</th>)}
                <th className="num hmscore" rowSpan={2}>Score</th>
              </tr>
              <tr>
                {cols.map((c) => <th key={c.id} className={'hmv' + (need.includes(c.id) ? ' on' : '')}><button onClick={() => toggle(need, setNeed, c.id)} aria-pressed={need.includes(c.id)} title="Filtrér: skal kunne">{c.name}</button></th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="hmname"><Link view="virksomhed" id={r.id}>{r.name}</Link></td>
                  {cols.map((c) => { const v = get(r.id, c.id); return (
                    <td key={c.id} className="hmc"><button className={'hm ' + (v === undefined ? 'hmn' : v === null ? 'hmq' : 'hm' + v)} onClick={() => cycle(r.id, c.id)} title={c.name + ': ' + LABEL(v)} aria-label={r.name + ', ' + c.name + ': ' + LABEL(v)}>{SYM(v)}</button></td>
                  ); })}
                  <td className="num hmscore">{r.score}<span className="mute">/{cols.length * 2}</span></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td className="hmname mute">Antal ja</td>{cols.map((c) => <td key={c.id} className="hmc mute">{yes(c.id)}</td>)}<td /></tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
