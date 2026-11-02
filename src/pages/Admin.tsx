import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { Err } from '../lib/ui';

type Row = { id: string; code: string; name: string; sort_order: number; active: boolean; is_system: boolean; is_ranked?: boolean };
const LISTS: { t: string; label: string; hint: string; ranked?: boolean }[] = [
  { t: 'label', label: 'Labels', hint: 'Fx Gå-hjem-møder og Seasonal greeting. Sættes på personer.' },
  { t: 'level', label: 'Niveauer', hint: 'Rang 1-3 tæller som beslutningstagere. Rækkefølgen er rangen.', ranked: true },
  { t: 'activity_type', label: 'Aktivitetstyper', hint: 'Fx Kaffemøde og Konference.' },
  { t: 'affiliation_type', label: 'Tilknytningstyper', hint: 'Fx medarbejder eller bestyrelse.' },
  { t: 'company_type', label: 'Virksomhedstyper', hint: 'Fx rådgiver, bygherre, fond.' },
  { t: 'sector', label: 'Sektorer', hint: 'Branche eller sektor på virksomheder.' },
  { t: 'acquaintance', label: 'Kendskab', hint: 'Hvor godt du kender personen. Privat for dig.' },
];
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'x' + Date.now();

export default function Admin() {
  const [t, setT] = useState(LISTS[0].t);
  const cur = LISTS.find((l) => l.t === t)!;
  const { data, error, reload } = useAsync(async () => {
    const r = await supabase.from(t).select('*').order('sort_order').order('name');
    if (r.error) throw r.error;
    return r.data as Row[];
  }, [t]);
  const [msg, setMsg] = useState<string | null>(null); const [nn, setNn] = useState('');
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { setMsg(null); const r = await p; if (r.error) setMsg(r.error.message.includes('foreign key') ? 'Værdien er i brug. Skjul den i stedet for at slette.' : r.error.message); reload(); };
  const upd = (id: string, v: Partial<Row>) => run(supabase.from(t).update(v).eq('id', id));
  const add = async () => { const max = Math.max(0, ...(data ?? []).map((x) => x.sort_order)); await run(supabase.from(t).insert({ code: slug(nn), name: nn.trim(), sort_order: max + 1 })); setNn(''); };
  const move = async (r: Row, d: -1 | 1) => {
    const l = data ?? []; const i = l.findIndex((x) => x.id === r.id); const o = l[i + d]; if (!o) return;
    await run(supabase.from(t).update({ sort_order: o.sort_order }).eq('id', r.id));
    await run(supabase.from(t).update({ sort_order: r.sort_order }).eq('id', o.id));
  };
  return (
    <>
      <h1>Admin</h1>
      <p className="sub">Vedligehold de lister, der bruges som valgmuligheder.</p>
      <div className="bar" role="tablist">{LISTS.map((l) => <button key={l.t} className={'btn sm ' + (l.t === t ? '' : 'ghost')} onClick={() => setT(l.t)}>{l.label}</button>)}</div>
      <p className="mute">{cur.hint}</p>
      <Err msg={error ?? msg} />
      <table>
        <thead><tr><th>Navn</th><th className="hide-s">Rækkefølge</th><th>Aktiv</th><th /></tr></thead>
        <tbody>{(data ?? []).map((r, i) => (
          <tr key={r.id}>
            <td><input defaultValue={r.name} key={r.id + r.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.name) upd(r.id, { name: v }); }} />{r.is_system && <span className="tag">Standard</span>}</td>
            <td className="hide-s"><button className="btn ghost sm" disabled={i === 0} onClick={() => move(r, -1)} aria-label="Flyt op">↑</button> <button className="btn ghost sm" disabled={i === (data?.length ?? 0) - 1} onClick={() => move(r, 1)} aria-label="Flyt ned">↓</button></td>
            <td><input type="checkbox" checked={r.active} onChange={(e) => upd(r.id, { active: e.target.checked })} aria-label="Aktiv" /></td>
            <td>{!r.is_system && <button className="btn ghost sm" onClick={() => confirm(`Slet ${r.name}?`) && run(supabase.from(t).delete().eq('id', r.id))}>Slet</button>}</td>
          </tr>))}</tbody>
      </table>
      <div className="bar">
        <input className="grow" placeholder={`Ny værdi i ${cur.label.toLowerCase()}`} value={nn} onChange={(e) => setNn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nn.trim() && add()} />
        <button className="btn" disabled={!nn.trim()} onClick={add}>Tilføj</button>
      </div>
      <p className="mute">Inaktive værdier skjules i valglister, men eksisterende data beholder dem. Standardværdier kan omdøbes og skjules, men ikke slettes.</p>
    </>
  );
}
