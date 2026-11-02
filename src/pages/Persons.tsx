import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { Link, Empty, Err, fullName } from '../lib/ui';

type Row = { contact_id: string; first_name: string; middle_name: string | null; last_name: string | null; email: string | null; company_name: string | null;
  title: string | null; labels: string | null; rank: number | null; is_decision_maker: boolean | null; city: string | null };

export default function Persons() {
  const { data, error, loading } = useAsync(async () => {
    const r = await supabase.from('v_contact_overview').select('contact_id,first_name,middle_name,last_name,email,company_name,title,labels,rank,is_decision_maker,city').eq('active', true).order('last_name').limit(5000);
    if (r.error) throw r.error;
    return r.data as Row[];
  }, [], 'persons');
  const [q, setQ] = useState('');
  const [dm, setDm] = useState(false);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r) => (!dm || r.is_decision_maker) &&
      (!s || [fullName(r), r.company_name, r.title, r.email, r.city].some((x) => x?.toLowerCase().includes(s))));
  }, [data, q, dm]);
  const total = data?.length ?? 0;
  const dms = (data ?? []).filter((r) => r.is_decision_maker).length;
  return (
    <>
      <h1>Personer</h1>
      <div className="kpis">
        <div><b>{total}</b><span>personer</span></div>
        <div><b>{dms}</b><span>beslutningstagere</span></div>
      </div>
      <div className="bar">
        <input className="grow" type="search" placeholder="Søg navn, virksomhed, titel, by" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Søg" />
        <label className="check"><input type="checkbox" checked={dm} onChange={(e) => setDm(e.target.checked)} /> Kun beslutningstagere</label>
        <Link view="person-ny" className="btn">Ny person</Link>
      </div>
      <Err msg={error} />
      {!loading && total === 0 && !error && <Empty title="Ingen personer endnu" text="Opret den første, eller importer din Excel-fil." />}
      {rows.length > 0 && (
        <table>
          <thead><tr><th className="num">Rang</th><th>Navn</th><th>Virksomhed og titel</th><th className="hide-s">By</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contact_id}>
                <td className="num"><span className="rank">{r.rank ?? ''}</span></td>
                <td><Link view="person" id={r.contact_id}>{fullName(r)}</Link>{' '}{r.is_decision_maker && <span className="dm">Beslutningstager</span>}</td>
                <td>{r.company_name ?? <span className="mute">Ingen tilknytning</span>}{r.title && <div className="mute">{r.title}</div>}{r.labels && <div>{r.labels.split(', ').map((l) => <span className="tag" key={l}>{l}</span>)}</div>}</td>
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
