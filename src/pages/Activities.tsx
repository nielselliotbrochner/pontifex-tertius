import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { Link, Empty, Err } from '../lib/ui';
import { useLookups } from '../lib/lookups';

type Row = { id: string; occurred_on: string; title: string; location: string | null; owner_present: boolean; type: { name: string } | null; activity_participant: { contact_id: string }[] };

export default function Activities() {
  const lk = useLookups();
  const { data, error, loading } = useAsync(async () => {
    const r = await supabase.from('activity').select('id,occurred_on,title,location,owner_present,type:activity_type(name),activity_participant(contact_id)').order('occurred_on', { ascending: false }).limit(3000);
    if (r.error) throw r.error;
    return r.data as unknown as Row[];
  }, [], 'activities');
  const [q, setQ] = useState(''); const [t, setT] = useState('');
  const rows = useMemo(() => (data ?? []).filter((a) => (!t || a.type?.name === t) && (!q.trim() || (a.title + ' ' + (a.location ?? '')).toLowerCase().includes(q.trim().toLowerCase()))), [data, q, t]);
  return (
    <>
      <h1>Aktiviteter</h1>
      <div className="kpis"><div><b>{data?.length ?? 0}</b><span>aktiviteter</span></div><div><b>{(data ?? []).filter((a) => !a.owner_present).length}</b><span>via kollega</span></div></div>
      <div className="bar">
        <input className="grow" type="search" placeholder="Søg titel eller sted" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Søg" />
        <select value={t} onChange={(e) => setT(e.target.value)} aria-label="Type"><option value="">Alle typer</option>{lk.data?.activity_type.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}</select>
        <Link view="aktivitet-ny" className="btn">Ny aktivitet</Link>
      </div>
      <Err msg={error} />
      {!loading && !error && (data?.length ?? 0) === 0 && <Empty title="Ingen aktiviteter endnu" text="Registrér et kaffemøde, en konference eller et opkald." />}
      {rows.length > 0 && (
        <table>
          <thead><tr><th>Dato</th><th>Aktivitet</th><th className="hide-s">Type</th><th className="num">Deltagere</th></tr></thead>
          <tbody>{rows.map((a) => (
            <tr key={a.id}><td style={{ whiteSpace: 'nowrap' }}>{a.occurred_on}</td>
              <td><Link view="aktivitet" id={a.id}>{a.title}</Link>{a.location && <div className="mute">{a.location}</div>}{!a.owner_present && <span className="tag">Via kollega</span>}</td>
              <td className="hide-s">{a.type?.name}</td><td className="num">{a.activity_participant.length}</td></tr>))}</tbody>
        </table>
      )}
      {loading && <p className="mute">Henter</p>}
    </>
  );
}
