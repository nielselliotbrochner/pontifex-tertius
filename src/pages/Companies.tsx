import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { Link, Empty, Err } from '../lib/ui';

type Row = { company_id: string; name: string; cvr: string | null; company_type: string | null; hq_city: string | null; parent_name: string | null; parent_company_id: string | null; owned_count: number; current_contacts: number };

export default function Companies() {
  const { data, error, loading } = useAsync(async () => {
    const r = await supabase.from('v_company_overview').select('company_id,name,cvr,company_type,hq_city,parent_name,parent_company_id,owned_count,current_contacts').eq('active', true).order('name').limit(5000);
    if (r.error) throw r.error;
    return r.data as Row[];
  }, [], 'companies');
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r) => !s || [r.name, r.cvr, r.hq_city, r.parent_name].some((x) => x?.toLowerCase().includes(s)));
  }, [data, q]);
  const total = data?.length ?? 0;
  return (
    <>
      <h1>Virksomheder</h1>
      <div className="kpis"><div><b>{total}</b><span>virksomheder</span></div><div><b>{(data ?? []).filter((r) => r.owned_count > 0).length}</b><span>med ejede selskaber</span></div></div>
      <div className="bar">
        <input className="grow" type="search" placeholder="Søg navn, CVR, by, ejer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Søg" />
        <Link view="virksomhed-ny" className="btn">Ny virksomhed</Link>
      </div>
      <Err msg={error} />
      {!loading && total === 0 && !error && <Empty title="Ingen virksomheder endnu" text="Opret den første, eller importer din Excel-fil." />}
      {rows.length > 0 && (
        <table>
          <thead><tr><th>Navn</th><th className="hide-s">Type</th><th>Hovedejer</th><th className="num">Personer</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.company_id}>
                <td><Link view="virksomhed" id={r.company_id}>{r.name}</Link>{r.hq_city && <div className="mute">{r.hq_city}</div>}</td>
                <td className="hide-s">{r.company_type}</td>
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
