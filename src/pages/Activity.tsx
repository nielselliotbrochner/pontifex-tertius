import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { go } from '../lib/nav';
import { Link, Err, Field } from '../lib/ui';
import { useCompanyOpts } from '../lib/CompanyPick';
import { useLookups } from '../lib/lookups';
import ActivityFiles from './ActivityFiles';
import { usePeople, type PickPerson } from '../lib/people';

type Part = { contact_id: string; company_id: string | null };
type Fu = { id: string; text: string; due_on: string | null; done_at: string | null; assigned_to: string | null };
type A = { id: string; type_id: string; occurred_on: string; title: string; body: string | null; location: string | null; owner_present: boolean; visibility: string };
const today = () => new Date().toISOString().slice(0, 10);
const nz = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export default function Activity({ id }: { id: string | null }) {
  const lk = useLookups(); const ppl = usePeople(); const cos = useCompanyOpts();
  const { data, error, loading, reload } = useAsync(async () => {
    if (!id) return { a: null as A | null, parts: [] as Part[], fus: [] as Fu[], subj: [] as string[], subc: [] as string[], users: [] as { user_id: string; display_name: string | null }[] };
    const [a, p, f, u, sp, sc] = await Promise.all([
      supabase.from('activity').select('*').eq('id', id).single(),
      supabase.from('activity_participant').select('contact_id,company_id').eq('activity_id', id),
      supabase.from('activity_followup').select('id,text,due_on,done_at,assigned_to').eq('activity_id', id).order('created_at'),
      supabase.from('app_user').select('user_id,display_name').eq('active', true),
      supabase.from('activity_subject').select('contact_id').eq('activity_id', id),
      supabase.from('activity_company').select('company_id').eq('activity_id', id),
    ]);
    if (a.error) throw a.error;
    return { a: a.data as A, parts: (p.data ?? []) as Part[], fus: (f.data ?? []) as Fu[], subj: (sp.data ?? []).map((x: { contact_id: string }) => x.contact_id), subc: (sc.data ?? []).map((x: { company_id: string }) => x.company_id), users: (u.data ?? []) as { user_id: string; display_name: string | null }[] };
  }, [id]);
  const [edit, setEdit] = useState(!id);
  const [f, setF] = useState<A | null>(null);
  const [parts, setParts] = useState<Part[] | null>(null);
  const [sj, setSj] = useState<string[] | null>(null);
  const [sc, setSc] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (error) return <Err msg={error} />;
  if (loading || !data || !lk.data || !ppl.data || !cos.data) return <p className="mute">Henter</p>;
  const blank: A = { id: '', type_id: lk.data.activity_type.find((t) => t.name === 'Kaffemøde')?.id ?? lk.data.activity_type[0]?.id ?? '', occurred_on: today(), title: '', body: '', location: '', owner_present: true, visibility: 'shared' };
  const a = f ?? data.a ?? blank; const cur = parts ?? data.parts;
  const set = <K extends keyof A>(k: K, v: A[K]) => setF({ ...a, [k]: v });
  const byId = new Map(ppl.data.map((p) => [p.id, p]));
  const typeName = lk.data.activity_type.find((t) => t.id === a.type_id)?.name;
  const curSj = sj ?? data.subj; const curSc = sc ?? data.subc;
  const coName = new Map(cos.data.map((c) => [c.id, c.name]));
  const mine = cur.filter((p) => byId.get(p.contact_id)?.own); const others = cur.filter((p) => !byId.get(p.contact_id)?.own);

  async function save() {
    setMsg(null);
    try { await doSave(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }
  async function doSave() {
    const payload = { type_id: a.type_id, occurred_on: a.occurred_on, title: a.title.trim(), body: nz(a.body), location: nz(a.location), owner_present: a.owner_present, visibility: a.visibility };
    const res = id ? await supabase.from('activity').update(payload).eq('id', id).select('id').single() : await supabase.from('activity').insert(payload).select('id').single();
    if (res.error) { setMsg(res.error.message); return; }
    const aid = res.data.id as string;
    await supabase.from('activity_participant').delete().eq('activity_id', aid);
    if (cur.length) { const x = await supabase.from('activity_participant').insert(cur.map((p) => ({ activity_id: aid, contact_id: p.contact_id, company_id: p.company_id }))); if (x.error) { setMsg(x.error.message); return; } }
    await supabase.from('activity_subject').delete().eq('activity_id', aid);
    if (curSj.length) { const x = await supabase.from('activity_subject').insert(curSj.map((c) => ({ activity_id: aid, contact_id: c }))); if (x.error) { setMsg(x.error.message); return; } }
    await supabase.from('activity_company').delete().eq('activity_id', aid);
    if (curSc.length) { const x = await supabase.from('activity_company').insert(curSc.map((c) => ({ activity_id: aid, company_id: c }))); if (x.error) { setMsg(x.error.message); return; } }
    setEdit(false); setF(null); setParts(null); setSj(null); setSc(null); reload(); go('aktivitet', aid);
  }
  async function del() {
    if (!id || !confirm('Slet aktiviteten?')) return;
    const x = await supabase.from('activity').delete().eq('id', id);
    if (x.error) setMsg(x.error.message); else go('aktiviteter');
  }
  const add = (p: PickPerson) => { if (!cur.some((x) => x.contact_id === p.id)) setParts([...cur, { contact_id: p.id, company_id: p.company_id }]); };
  const drop = (cid: string) => setParts(cur.filter((x) => x.contact_id !== cid));
  const chip = (p: Part, ed: boolean) => { const o = byId.get(p.contact_id); return (
    <li key={p.contact_id}><span className="grow"><Link view="person" id={p.contact_id}>{o?.name ?? '…'}</Link><div className="mute">{o?.company_name}</div></span>{ed && <button className="btn ghost sm" onClick={() => drop(p.contact_id)}>Fjern</button>}</li>); };

  return (
    <>
      <Link view="aktiviteter" className="mute">Aktiviteter</Link>
      <h1>{id ? data.a?.title : 'Ny aktivitet'}</h1>
      <Err msg={msg} />
      {edit ? (
        <>
          <div className="grid" style={{ marginTop: 16 }}>
            <Field label="Type"><select value={a.type_id} onChange={(e) => set('type_id', e.target.value)}>{lk.data.activity_type.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <Field label="Dato"><input type="date" value={a.occurred_on} onChange={(e) => set('occurred_on', e.target.value)} /></Field>
            <Field label="Sted"><input value={a.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="Fx café, konference, telefon" /></Field>
            <Field label="Titel" wide><input value={a.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <label className="check wide"><input type="checkbox" checked={a.owner_present} onChange={(e) => set('owner_present', e.target.checked)} /> Jeg var selv til stede (fjern hak, hvis en kollega gav mig intel)</label>
            <Field label="Referat og intel" wide><textarea rows={6} value={a.body ?? ''} onChange={(e) => set('body', e.target.value)} /></Field>
            <label className="check wide"><input type="checkbox" checked={a.visibility === 'private'} onChange={(e) => set('visibility', e.target.checked ? 'private' : 'shared')} /> Kun synlig for mig</label>
          </div>
          <h2>Deltagere uden for NIRAS</h2>
          <ul className="list">{others.map((p) => chip(p, true))}</ul>
          <Picker people={ppl.data.filter((p) => !p.own)} onPick={add} listId="pp-ext" placeholder="Tilføj deltager (navn eller virksomhed)" />
          <h2>Fra NIRAS</h2>
          <ul className="list">{mine.map((p) => chip(p, true))}</ul>
          <Picker people={ppl.data.filter((p) => p.own)} onPick={add} listId="pp-own" placeholder="Tilføj kollega" />
          {ppl.data.every((p) => !p.own) && <p className="mute">Ingen kolleger oprettet endnu. Opret dem som personer med tilknytning til NIRAS.</p>}
          <h2>Omtalt</h2>
          <p className="mute">Personer og virksomheder, aktiviteten handler om, men som ikke var til stede.</p>
          <ul className="list">
            {curSj.map((c) => <li key={c}><span className="grow">{byId.get(c)?.label ?? '…'}</span><button className="btn ghost sm" onClick={() => setSj(curSj.filter((x) => x !== c))}>Fjern</button></li>)}
            {curSc.map((c) => <li key={c}><span className="grow">{coName.get(c) ?? '…'}</span><span className="tag">Virksomhed</span><button className="btn ghost sm" onClick={() => setSc(curSc.filter((x) => x !== c))}>Fjern</button></li>)}
          </ul>
          <Picker people={ppl.data} onPick={(p) => !curSj.includes(p.id) && setSj([...curSj, p.id])} listId="pp-sj" placeholder="Tilføj omtalt person" />
          <div className="bar"><input className="grow" list="co-sc" placeholder="Tilføj omtalt virksomhed" value="" onChange={(e) => { const m = cos.data!.find((c) => c.name === e.target.value); if (m && !curSc.includes(m.id)) setSc([...curSc, m.id]); }} /><datalist id="co-sc">{cos.data.map((c) => <option key={c.id} value={c.name} />)}</datalist></div>
          {id ? <ActivityFiles aid={id} /> : <p className="mute">Gem aktiviteten først, så kan du vedhæfte filer og fotos.</p>}
          <Err msg={msg} />
          <div className="bar">
            <button className="btn" disabled={!a.title.trim() || !a.type_id} onClick={save}>Gem</button>
            {!a.title.trim() && <span className="mute">Titel mangler</span>}{!a.type_id && <span className="mute">Vælg en type</span>}
            <button className="btn ghost" onClick={() => (id ? (setEdit(false), setF(null), setParts(null), setSj(null), setSc(null)) : go('aktiviteter'))}>Annuller</button>
            <span className="grow" />{id && <button className="btn ghost" onClick={del}>Slet</button>}
          </div>
        </>
      ) : data.a && (
        <>
          <p className="sub">{[data.a.occurred_on, typeName, data.a.location].filter(Boolean).join(' · ')}</p>
          <div className="bar"><button className="btn ghost sm" onClick={() => setEdit(true)}>Redigér</button>{!data.a.owner_present && <span className="dm">Via kollega</span>}{data.a.visibility === 'private' && <span className="tag">Privat</span>}</div>
          {data.a.body && <p style={{ whiteSpace: 'pre-wrap', maxWidth: 720 }}>{data.a.body}</p>}
          <div className="row2">
            <div><h2>Deltagere</h2>{others.length ? <ul className="list">{others.map((p) => chip(p, false))}</ul> : <p className="mute">Ingen registreret.</p>}</div>
            <div><h2>Fra NIRAS</h2>{mine.length ? <ul className="list">{mine.map((p) => chip(p, false))}</ul> : <p className="mute">Ingen registreret.</p>}</div>
          </div>
          {(data.subj.length > 0 || data.subc.length > 0) && (<><h2>Omtalt</h2><ul className="list">
            {data.subj.map((c) => <li key={c}><Link view="person" id={c}>{byId.get(c)?.name ?? '…'}</Link><span className="mute">{byId.get(c)?.company_name}</span></li>)}
            {data.subc.map((c) => <li key={c}><Link view="virksomhed" id={c}>{coName.get(c) ?? '…'}</Link><span className="tag">Virksomhed</span></li>)}
          </ul></>)}
          <ActivityFiles aid={id!} />
          <Followups aid={id!} fus={data.fus} users={data.users} onChange={reload} />
        </>
      )}
    </>
  );
}

function Picker({ people, onPick, listId, placeholder }: { people: PickPerson[]; onPick: (p: PickPerson) => void; listId: string; placeholder: string }) {
  const [v, setV] = useState('');
  return (<div className="bar"><input className="grow" list={listId} value={v} placeholder={placeholder} onChange={(e) => {
    const val = e.target.value; setV(val); const m = people.find((p) => p.label === val); if (m) { onPick(m); setV(''); }
  }} /><datalist id={listId}>{people.map((p) => <option key={p.id} value={p.label} />)}</datalist></div>);
}

function Followups({ aid, fus, users, onChange }: { aid: string; fus: Fu[]; users: { user_id: string; display_name: string | null }[]; onChange: () => void }) {
  const [text, setText] = useState(''); const [due, setDue] = useState(''); const [who, setWho] = useState('');
  const name = (u: string | null) => users.find((x) => x.user_id === u)?.display_name ?? '';
  const [fe, setFe] = useState<string | null>(null);
  async function add() { const x = await supabase.from('activity_followup').insert({ activity_id: aid, text: text.trim(), due_on: due || null, assigned_to: who || undefined }); if (x.error) { setFe(x.error.message); return; } setFe(null); setText(''); setDue(''); onChange(); }
  const toggle = async (f: Fu) => { await supabase.from('activity_followup').update({ done_at: f.done_at ? null : new Date().toISOString() }).eq('id', f.id); onChange(); };
  return (
    <>
      <h2>Opfølgning</h2>
      <Err msg={fe} />
      {fus.length === 0 && <p className="mute">Ingen opfølgninger.</p>}
      <ul className="list">{fus.map((f) => (
        <li key={f.id}><label className="check grow"><input type="checkbox" checked={!!f.done_at} onChange={() => toggle(f)} /><span style={f.done_at ? { textDecoration: 'line-through' } : undefined}>{f.text}</span></label>
          <span className="mute">{[f.due_on, name(f.assigned_to)].filter(Boolean).join(' · ')}</span></li>))}</ul>
      <div className="bar">
        <input className="grow" placeholder="Ny opfølgning" value={text} onChange={(e) => setText(e.target.value)} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Frist" />
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Ansvarlig"><option value="">Mig</option>{users.map((u) => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}</select>
        <button className="btn ghost sm" disabled={!text.trim()} onClick={add}>Tilføj</button>
      </div>
    </>
  );
}
