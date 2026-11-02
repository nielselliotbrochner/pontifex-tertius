import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { go } from '../lib/nav';
import { Link, Err, Field, fullName } from '../lib/ui';
import { useLookups } from '../lib/lookups';
import MergePerson from './MergePerson';
import { CompanyPick, findCompany, useCompanyOpts } from '../lib/CompanyPick';

type Contact = { id: string; first_name: string; middle_name: string | null; last_name: string | null; email: string | null; phone: string | null; linkedin_url: string | null };
type Rel = { acquaintance_id: string | null; mobile: string | null; notes: string | null; podcast_relevant: boolean };
type Act = { id: string; occurred_on: string; title: string; type: { name: string } | null };
type Aff = { id: string; company_id: string; title: string | null; is_primary: boolean; start_date: string | null; end_date: string | null; company: { name: string } | null; affiliation_type: { name: string } | null; contact_company_level: { level: { name: string; sort_order: number; is_ranked: boolean } | null }[] };

const blank: Contact = { id: '', first_name: '', middle_name: '', last_name: '', email: '', phone: '', linkedin_url: '' };
const nz = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export default function Person({ id }: { id: string | null }) {
  const lk = useLookups();
  const { data, error, loading, reload } = useAsync(async () => {
    if (!id) return { c: blank, rel: { acquaintance_id: null, mobile: '', notes: '', podcast_relevant: false } as Rel, affs: [] as Aff[], labels: [] as string[], activities: [] as Act[], mentioned: [] as Act[] };
    const [c, rel, affs, labs, acts, mnt] = await Promise.all([
      supabase.from('contact').select('*').eq('id', id).single(),
      supabase.from('contact_relation').select('acquaintance_id,mobile,notes,podcast_relevant').eq('contact_id', id).maybeSingle(),
      supabase.from('contact_company').select('id,company_id,title,is_primary,start_date,end_date,company(name),affiliation_type(name),contact_company_level(level(name,sort_order,is_ranked))').eq('contact_id', id).order('end_date', { nullsFirst: true, ascending: false }).order('start_date', { ascending: false, nullsFirst: false }),
      supabase.from('contact_label').select('label_id').eq('contact_id', id),
      supabase.from('activity_participant').select('activity(id,occurred_on,title,type:activity_type(name))').eq('contact_id', id),
      supabase.from('activity_subject').select('activity(id,occurred_on,title,type:activity_type(name))').eq('contact_id', id),
    ]);
    if (c.error) throw c.error;
    const mentioned = ((mnt.data ?? []) as unknown as { activity: Act | null }[]).map((x) => x.activity).filter((a): a is Act => !!a).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
    const activities = ((acts.data ?? []) as unknown as { activity: Act | null }[]).map((x) => x.activity).filter((a): a is Act => !!a).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
    return { c: c.data as Contact, rel: (rel.data ?? { acquaintance_id: null, mobile: '', notes: '', podcast_relevant: false }) as Rel, affs: (affs.data ?? []) as unknown as Aff[], labels: (labs.data ?? []).map((x: { label_id: string }) => x.label_id), activities, mentioned };
  }, [id]);
  const [edit, setEdit] = useState(!id);
  const [f, setF] = useState<Contact | null>(null);
  const [r, setR] = useState<Rel | null>(null);
  const [lb, setLb] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <Err msg={error} />;
  if (loading || !data) return <p className="mute">Henter</p>;
  const c = f ?? data.c; const rel = r ?? data.rel; const labels = lb ?? data.labels;
  const set = (k: keyof Contact, v: string) => setF({ ...c, [k]: v });

  async function save() {
    setBusy(true); setMsg(null);
    const payload = { first_name: c.first_name, middle_name: nz(c.middle_name), last_name: nz(c.last_name), email: nz(c.email), phone: nz(c.phone), linkedin_url: nz(c.linkedin_url) };
    const res = id ? await supabase.from('contact').update(payload).eq('id', id).select('id').single() : await supabase.from('contact').insert(payload).select('id').single();
    if (res.error) { setMsg(res.error.message.includes('contact_linkedin_uq') ? 'LinkedIn-profilen findes allerede hos en anden person.' : res.error.message); setBusy(false); return; }
    const cid = res.data.id as string;
    const rr = await supabase.from('contact_relation').upsert({ contact_id: cid, acquaintance_id: rel.acquaintance_id || null, mobile: nz(rel.mobile), notes: nz(rel.notes), podcast_relevant: !!rel.podcast_relevant }, { onConflict: 'owner_id,contact_id' });
    await supabase.from('contact_label').delete().eq('contact_id', cid);
    if (labels.length) await supabase.from('contact_label').insert(labels.map((label_id) => ({ contact_id: cid, label_id })));
    setBusy(false);
    if (rr.error) { setMsg(rr.error.message); return; }
    go('person', cid);
    setEdit(false); setF(null); setR(null); setLb(null); reload();
  }
  async function del() {
    if (!id || !confirm('Slet personen og alle tilknytninger?')) return;
    const x = await supabase.from('contact').delete().eq('id', id);
    if (x.error) setMsg(x.error.message); else go('personer');
  }

  const cur = data.affs.filter((a) => !a.end_date);
  const past = data.affs.filter((a) => a.end_date);
  return (
    <>
      <Link view="personer" className="mute">Personer</Link>
      <h1>{id ? fullName(data.c) : 'Ny person'}</h1>
      {id && !edit && (
        <p className="sub">
          {data.c.email && <a href={'mailto:' + data.c.email}>{data.c.email}</a>}
          {data.c.phone && <> · {data.c.phone}</>}
          {data.c.linkedin_url && <> · <a href={data.c.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a></>}
        </p>
      )}
      <Err msg={msg} />
      {edit ? (
        <>
          <h2>Person</h2>
          <div className="grid">
            <Field label="Fornavn"><input value={c.first_name} onChange={(e) => set('first_name', e.target.value)} /></Field>
            <Field label="Mellemnavn"><input value={c.middle_name ?? ''} onChange={(e) => set('middle_name', e.target.value)} /></Field>
            <Field label="Efternavn"><input value={c.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} /></Field>
            <Field label="E-mail (delt)"><input type="email" value={c.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Telefon arbejde (delt)"><input value={c.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="LinkedIn"><input value={c.linkedin_url ?? ''} onChange={(e) => set('linkedin_url', e.target.value)} placeholder="https://www.linkedin.com/in/..." /></Field>
          </div>
          <h2>Labels</h2>
          <div>{lk.data?.label.map((o) => <label className="check" key={o.id} style={{ display: 'inline-flex', marginRight: 16 }}>
            <input type="checkbox" checked={labels.includes(o.id)} onChange={(e) => setLb(e.target.checked ? [...labels, o.id] : labels.filter((x) => x !== o.id))} />{o.name}</label>)}</div>
          <h2>Kun synligt for dig</h2>
          <div className="grid">
            <Field label="Mobil (privat)"><input value={rel.mobile ?? ''} onChange={(e) => setR({ ...rel, mobile: e.target.value })} /></Field>
            <Field label="Kendskab"><select value={rel.acquaintance_id ?? ''} onChange={(e) => setR({ ...rel, acquaintance_id: e.target.value || null })}><option value="">Ikke angivet</option>{lk.data?.acquaintance.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <label className="check"><input type="checkbox" checked={!!rel.podcast_relevant} onChange={(e) => setR({ ...rel, podcast_relevant: e.target.checked })} /> Relevant for podcast</label>
            <Field label="Noter (private)" wide><textarea rows={5} value={rel.notes ?? ''} onChange={(e) => setR({ ...rel, notes: e.target.value })} /></Field>
          </div>
          <div className="bar">
            <button className="btn" disabled={busy || !c.first_name.trim()} onClick={save}>Gem</button>
            <button className="btn ghost" onClick={() => (id ? (setEdit(false), setF(null), setR(null), setLb(null)) : go('personer'))}>Annuller</button>
            <span className="grow" />
            {id && <button className="btn ghost" onClick={del}>Slet</button>}
          </div>
        </>
      ) : (
        <>
          <div className="bar"><button className="btn ghost sm" onClick={() => setEdit(true)}>Redigér</button>
            {rel.podcast_relevant && <span className="dm">Relevant for podcast</span>}
            {data.labels.map((l) => <span className="tag" key={l}>{lk.data?.label.find((o) => o.id === l)?.name}</span>)}</div>
          <div className="row2">
            <div className="panel"><h2>Privat</h2>
              <p>{rel.mobile ? <>Mobil {rel.mobile}</> : <span className="mute">Intet mobilnummer</span>}</p>
              {rel.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{rel.notes}</p> : <p className="mute">Ingen noter</p>}
            </div>
          </div>
        </>
      )}
      {id && !edit && (<><h2>Aktiviteter</h2>{data.activities.length === 0 ? <p className="mute">Ingen aktiviteter.</p> :
        <ul className="list">{data.activities.map((a) => <li key={a.id}><span className="mute" style={{ minWidth: 92 }}>{a.occurred_on}</span><span className="grow"><Link view="aktivitet" id={a.id}>{a.title}</Link></span><span className="tag">{a.type?.name}</span></li>)}</ul>}
        {data.mentioned.length > 0 && (<><h2>Omtalt i</h2><ul className="list">{data.mentioned.map((a) => <li key={a.id}><span className="mute" style={{ minWidth: 92 }}>{a.occurred_on}</span><span className="grow"><Link view="aktivitet" id={a.id}>{a.title}</Link></span><span className="tag">{a.type?.name}</span></li>)}</ul></>)}</>)}
      {id && <Affiliations contactId={id} cur={cur} past={past} onChange={reload} />}
      {id && !edit && <MergePerson id={id} name={fullName(c)} />}
    </>
  );
}

function Affiliations({ contactId, cur, past, onChange }: { contactId: string; cur: Aff[]; past: Aff[]; onChange: () => void }) {
  const lk = useLookups(); const co = useCompanyOpts();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [typ, setTyp] = useState(''); const [title, setTitle] = useState('');
  const [lv, setLv] = useState<string[]>([]); const [prim, setPrim] = useState(cur.length === 0);
  const [sd, setSd] = useState(''); const [ed, setEd] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function add() {
    const company = findCompany(co.data ?? [], name);
    if (!company) { setMsg('Vælg en virksomhed fra listen. Opret den først, hvis den ikke findes.'); return; }
    if (sd && ed && ed < sd) { setMsg('Slutdato ligger før startdato.'); return; }
    const type = typ || lk.data?.affiliation_type[0]?.id;
    const makePrimary = prim && !ed;
    if (makePrimary) await supabase.from('contact_company').update({ is_primary: false }).eq('contact_id', contactId).eq('is_primary', true);
    const x = await supabase.from('contact_company').insert({ contact_id: contactId, company_id: company.id, affiliation_type_id: type, title: title.trim() || null, is_primary: makePrimary, start_date: sd || null, end_date: ed || null }).select('id').single();
    if (x.error) { setMsg(x.error.message); return; }
    if (lv.length) { const y = await supabase.from('contact_company_level').insert(lv.map((level_id) => ({ contact_company_id: x.data.id, level_id }))); if (y.error) { setMsg(y.error.message); return; } }
    setOpen(false); setName(''); setTitle(''); setLv([]); setSd(''); setEd(''); setMsg(null); onChange();
  }
  const end = async (a: Aff) => { await supabase.from('contact_company').update({ end_date: new Date().toISOString().slice(0, 10), is_primary: false }).eq('id', a.id); onChange(); };
  const setDates = async (a: Aff, f: 'start_date' | 'end_date', v: string) => {
    const nv = v || null; const s0 = f === 'start_date' ? nv : a.start_date; const e0 = f === 'end_date' ? nv : a.end_date;
    if (s0 && e0 && e0 < s0) { setMsg('Slutdato ligger før startdato.'); return; }
    setMsg(null);
    const x = await supabase.from('contact_company').update(f === 'end_date' && nv ? { end_date: nv, is_primary: false } : { [f]: nv }).eq('id', a.id);
    if (x.error) setMsg(x.error.message); else onChange();
  };
  const rm = async (a: Aff) => { if (confirm('Fjern tilknytningen?')) { await supabase.from('contact_company').delete().eq('id', a.id); onChange(); } };
  const row = (a: Aff, active: boolean) => (
    <li key={a.id}>
      <span className="grow"><Link view="virksomhed" id={a.company_id}>{a.company?.name}</Link>{a.is_primary && active && <span className="tag" style={{ marginLeft: 8 }}>Primær</span>}
        <div className="mute">{[a.title, a.affiliation_type?.name].filter(Boolean).join(' · ')}</div></span>
      <span>{a.contact_company_level.map((l) => l.level && <span className="tag" key={l.level.name}>{l.level.name}</span>)}</span>
      <span className="dates">
        <input type="date" aria-label="Start" title="Start" defaultValue={a.start_date ?? ''} key={'s' + a.id + a.start_date} onBlur={(e) => e.target.value !== (a.start_date ?? '') && setDates(a, 'start_date', e.target.value)} />
        <span className="mute">til</span>
        <input type="date" aria-label="Slut" title={active ? 'Tom = stadig tilknyttet' : 'Slut'} defaultValue={a.end_date ?? ''} key={'e' + a.id + a.end_date} onBlur={(e) => e.target.value !== (a.end_date ?? '') && setDates(a, 'end_date', e.target.value)} />
      </span>
      {active && <button className="btn ghost sm" onClick={() => end(a)}>Afslut i dag</button>}
      <button className="btn ghost sm" onClick={() => rm(a)}>Fjern</button>
    </li>
  );
  return (
    <>
      <h2>Tilknytninger</h2>
      <Err msg={open ? null : msg} />
      {cur.length === 0 && !open && <p className="mute">Ingen aktive tilknytninger.</p>}
      <ul className="list">{cur.map((a) => row(a, true))}</ul>
      {past.length > 0 && <><h2>Tidligere</h2><ul className="list">{past.map((a) => row(a, false))}</ul></>}
      {open ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <Err msg={msg} />
          <div className="grid">
            <Field label="Virksomhed"><CompanyPick value={name} onChange={setName} options={co.data ?? []} listId="co-aff" /></Field>
            <Field label="Type"><select value={typ} onChange={(e) => setTyp(e.target.value)}>{lk.data?.affiliation_type.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <Field label="Titel (fri tekst)" wide><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Niveau (flere kan vælges)" wide>
              <div>{lk.data?.level.map((o) => <label className="check" key={o.id} style={{ display: 'inline-flex', marginRight: 16 }}>
                <input type="checkbox" checked={lv.includes(o.id)} onChange={(e) => setLv(e.target.checked ? [...lv, o.id] : lv.filter((x) => x !== o.id))} />
                {o.is_ranked ? o.sort_order + ' ' : ''}{o.name}</label>)}</div>
            </Field>
            <Field label="Start"><input type="date" value={sd} onChange={(e) => setSd(e.target.value)} /></Field>
            <Field label="Slut (tom = stadig tilknyttet)"><input type="date" value={ed} onChange={(e) => setEd(e.target.value)} /></Field>
            <label className="check"><input type="checkbox" checked={prim} onChange={(e) => setPrim(e.target.checked)} /> Primær tilknytning</label>
          </div>
          <div className="bar"><button className="btn" onClick={add}>Tilføj</button><button className="btn ghost" onClick={() => setOpen(false)}>Annuller</button></div>
        </div>
      ) : <div className="bar"><button className="btn ghost sm" onClick={() => setOpen(true)}>Tilføj tilknytning</button></div>}
    </>
  );
}
