import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { go } from '../lib/nav';
import { Err } from '../lib/ui';
import { usePeople } from '../lib/people';

export default function MergePerson({ id, name }: { id: string; name: string }) {
  const ppl = usePeople();
  const [open, setOpen] = useState(false); const [v, setV] = useState(''); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const others = (ppl.data ?? []).filter((p) => p.id !== id);
  const pick = others.find((p) => p.label === v);
  async function run() {
    if (!pick) return;
    if (!confirm(`Flet »${pick.label}« ind i »${name}«? Den anden person slettes, og alt flyttes hertil. Det kan ikke fortrydes.`)) return;
    setBusy(true); setMsg(null);
    const r = await supabase.rpc('merge_contacts', { keep: id, drop_id: pick.id });
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    go('person', id); location.reload();
  }
  if (!open) return <div className="bar"><button className="btn ghost sm" onClick={() => setOpen(true)}>Flet med anden person</button></div>;
  return (
    <>
      <h2>Flet dublet</h2>
      <p className="mute">Vælg den dublet, der skal forsvinde. {name} beholdes. Tilknytninger, aktiviteter, labels og private noter flyttes hertil, og tomme felter udfyldes fra dubletten.</p>
      <Err msg={msg} />
      <div className="bar">
        <input className="grow" list="merge-list" value={v} onChange={(e) => setV(e.target.value)} placeholder="Søg dublet (navn eller virksomhed)" />
        <datalist id="merge-list">{others.map((p) => <option key={p.id} value={p.label} />)}</datalist>
        <button className="btn" disabled={!pick || busy} onClick={run}>{busy ? 'Fletter' : 'Flet'}</button>
        <button className="btn ghost" onClick={() => { setOpen(false); setV(''); }}>Annuller</button>
      </div>
    </>
  );
}
