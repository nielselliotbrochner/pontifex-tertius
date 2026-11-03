import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { fetchAll } from '../lib/fetchAll';
import { Link, Empty, Err } from '../lib/ui';

type Row = { company_id: string; name: string; cvr: string | null; company_type: string | null; hq_city: string | null; parent_name: string | null; parent_company_id: string | null; owned_count: number; current_contacts: number };

export default function Companies() {
  const { data: all, error, loading } = useAsync(async () => {
    const [r, br, cb, nh] = await Promise.all([
      supabase.from('v_company_overview').select('company_id,name,cvr,company_type,hq_city,parent_name,parent_company_id,owned_count,current_contacts').eq('active', true).order('name').limit(5000),
      supabase.from('branch').select('id,name,sort_order').eq('active', true).order('sort_order'),
      fetchAll<{ company_id: string; branch_id: string }>((f, t) => supabase.from('company_branch').select('company_id,branch_id').order('company_id').order('branch_id').range(f, t)),
      fetchAll<{ company_id: string; name: string }>((f, t) => supabase.from('company_name_history').select('company_id,name').order('company_id').order('name').range(f, t)),
    ]);
    if (r.error) throw r.error; if (br.error) throw br.error;
    const by = new Map<string, Set<string>>(); for (const x of cb) (by.get(x.company_id) ?? by.set(x.company_id, new Set()).get(x.company_id)!).add(x.branch_id);
    const old = new Map<string, string[]>(); for (const x of nh) (old.get(x.company_id) ?? old.set(x.company_id, []).get(x.company_id)!).push(x.name);
    return { old, rows: r.data as Row[], branches: br.data as { id: string; name: string }[], by };
  }, [], 'companies');
  const data = all?.rows;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]); const [every, setEvery] = useState(false);
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const nameOfBranch = (id: string) => all?.branches.find((b) => b.id === id)?.name ?? '';
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (s && ![r.name, r.cvr, r.hq_city, r.parent_name, ...(all?.old.get(r.company_id) ?? [])].some((x) => x?.toLowerCase().includes(s))) return false;
      if (!sel.length) return true;
      const mine = all?.by.get(r.company_id); if (!mine) return false;
      return every ? sel.every((b) => mine.has(b)) : sel.some((b) => mine.has(b));
    });
  }, [data, q, sel, every, all]);
  const total = data?.length ?? 0;
  return (
    <>
      <h1>Virksomheder</h1>
      <div className="kpis"><div><b>{total}</b><span>virksomheder</span></div><div><b>{(data ?? []).filter((r) => r.owned_count > 0).length}</b><span>med ejede selskaber</span></div></div>
      <div className="bar">
        <input className="grow" type="search" placeholder="Søg navn, CVR, by, ejer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Søg" />
        <Link view="virksomhed-ny" className="btn">Ny virksomhed</Link>
      </div>
      {all && all.branches.length > 0 && (
        <div className="bar" role="group" aria-label="Filtrér på branche">
          <span className="mono mute">Branche</span>
          {all.branches.map((b) => <button key={b.id} className={'btn sm ' + (sel.includes(b.id) ? '' : 'ghost')} aria-pressed={sel.includes(b.id)} onClick={() => toggle(b.id)}>{b.name}</button>)}
          {sel.length > 1 && <label className="check"><input type="checkbox" checked={every} onChange={(e) => setEvery(e.target.checked)} /> Skal have alle valgte</label>}
          {sel.length > 0 && <button className="btn ghost sm" onClick={() => setSel([])}>Nulstil</button>}
        </div>
      )}
      {sel.length > 0 && <p className="mute">{rows.length} af {total} virksomheder</p>}
      <Err msg={error} />
      {!loading && total === 0 && !error && <Empty title="Ingen virksomheder endnu" text="Opret den første, eller importer din Excel-fil." />}
      {rows.length > 0 && (
        <table>
          <thead><tr><th>Navn</th><th className="hide-s">Type</th><th className="hide-s">Brancher</th><th>Hovedejer</th><th className="num">Personer</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.company_id}>
                <td><Link view="virksomhed" id={r.company_id}>{r.name}</Link>{(all?.old.get(r.company_id) ?? []).length > 0 && <div className="mute">tidl. {all!.old.get(r.company_id)!.join(', ')}</div>}{r.hq_city && <div className="mute">{r.hq_city}</div>}</td>
                <td className="hide-s">{r.company_type}</td>
                <td className="hide-s">{[...(all?.by.get(r.company_id) ?? [])].map((b) => <span className="tag" key={b}>{nameOfBranch(b)}</span>)}</td>
                <td>{r.parent_company_id ? <Link view="virksomhed" id={r.parent_company_id}>{r.parent_name}</Link> : <span className="mute">Ingen</span>}</td>
                <td className="num">{r.current_contacts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {loading && <p className="mute">Henter</p>}
    </>
  );
}
