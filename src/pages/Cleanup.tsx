import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { Link, Err, fullName } from '../lib/ui';

type P = { contact_id: string; first_name: string; middle_name: string | null; last_name: string | null; email: string | null; company_name: string | null; title: string | null; labels: string | null };

export default function Cleanup() {
  const { data, error, loading } = useAsync(async () => {
    const r = await supabase.from('v_contact_overview').select('contact_id,first_name,middle_name,last_name,email,company_name,title,labels').eq('active', true).limit(10000);
    if (r.error) throw r.error;
    return r.data as P[];
  }, [], 'cleanup');
  const groups = useMemo(() => {
    const d = data ?? [];
    const key = (p: P) => ((p.first_name ?? '') + ' ' + (p.last_name ?? '')).trim().toLowerCase();
    const by = (f: (p: P) => string | null) => { const m = new Map<string, P[]>(); d.forEach((p) => { const k = f(p); if (k) m.set(k, [...(m.get(k) ?? []), p]); }); return [...m.values()].filter((x) => x.length > 1).flat(); };
    return [
      { t: 'Navn at tjekke', h: 'Mangler efternavn, eller navnet indeholder e-mail eller komma.', l: d.filter((p) => !p.last_name || /[@,]/.test(p.first_name)) },
      { t: 'Samme navn flere gange', h: 'Kan være dubletter eller to forskellige personer.', l: by(key).sort((a, b) => key(a).localeCompare(key(b))) },
      { t: 'Delt e-mail', h: 'Samme e-mail på flere personer.', l: by((p) => p.email?.toLowerCase() ?? null).sort((a, b) => (a.email ?? '').localeCompare(b.email ?? '')) },
      { t: 'Uden virksomhed', h: 'Ingen aktiv tilknytning.', l: d.filter((p) => !p.company_name) },
      { t: 'Titel uden niveau', h: 'Titel er skrevet, men der er ikke sat nogen rang. Ramte ingen af ordene i den automatiske tolkning.', l: d.filter((p) => p.title && !p.labels) },
    ];
  }, [data]);
  return (
    <>
      <h1>Oprydning</h1>
      <p className="sub">Forslag til rettelser efter importen. Åbn en person for at rette.</p>
      <Err msg={error} />
      {loading && <p className="mute">Henter</p>}
      <div className="kpis">{groups.map((g) => <div key={g.t}><b>{g.l.length}</b><span>{g.t}</span></div>)}</div>
      {groups.map((g) => (
        <section key={g.t}>
          <h2>{g.t} ({g.l.length})</h2>
          <p className="mute" style={{ marginTop: 0 }}>{g.h}</p>
          {g.l.length > 0 && (
            <table><tbody>{g.l.slice(0, 400).map((p) => (
              <tr key={p.contact_id}><td><Link view="person" id={p.contact_id}>{fullName(p)}</Link></td><td>{p.company_name ?? <span className="mute">Ingen</span>}</td><td className="hide-s mute">{p.email ?? p.title}</td></tr>
            ))}</tbody></table>
          )}
        </section>
      ))}
    </>
  );
}
