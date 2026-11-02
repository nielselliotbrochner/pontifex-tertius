import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { go } from '../lib/nav';
import { Link, Err, Field, fullName } from '../lib/ui';
import { useLookups } from '../lib/lookups';
import { CompanyPick, findCompany, useCompanyOpts } from '../lib/CompanyPick';

type Contact = { id: string; first_name: string; middle_name: string | null; last_name: string | null; email: string | null; phone: string | null; linkedin_url: string | null };
type Rel = { acquaintance_id: string | null; mobile: string | null; notes: string | null };
type Aff = { id: string; company_id: string; title: string | null; is_primary: boolean; end_date: string | null; company: { name: string } | null; affiliation_type: { name: string } | null; contact_company_level: { level: { name: string; sort_order: number; is_ranked: boolean } | null }[] };

const blank: Contact = { id: '', first_name: '', middle_name: '', last_name: '', email: '', phone: '', linkedin_url: '' };
const nz = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export default function Person({ id }: { id: string | null }) {
  const lk = useLookups();
  const { data, error, loading, reload } = useAsync(async () => {
    if (!id) return { c: blank, rel: { acquaintance_id: null, mobile: '', notes: '' } as Rel, affs: [] as Aff[] };
    const [c, rel, affs] = await Promise.all([
      supabase.from('contact').select('*').eq('id', id).single(),
      supabase.from('contact_relation').select('acquaintance_id,mobile,notes').eq('contact_id', id).maybeSingle(),
      supabase.from('contact_company').select('id,company_id,title,is_primary,end_date,company(name),affiliation_type(name),contact_company_level(level(name,sort_order,is_ranked))').eq('contact_id', id).order('end_date', { nullsFirst: true }),
    ]);
    if (c.error) throw c.error;
    return { c: c.data as Contact, rel: (rel.data ?? { acquaintance_id: null, mobile: '', notes: '' }) as Rel, affs: (affs.data ?? []) as unknown as Aff[] };
  }, [id]);
  const [edit, setEdit] = useState(!id);
  const [f, setF] = useState<Contact | null>(null);
  const [r, setR] = useState<Rel | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <Err msg={error} />;
  if (loading || !data) return <p className="mute">Henter</p>;
  const c = f ?? data.c; const rel = r ?? data.rel;
  const set = (k: keyof Contact, v: string) => setF({ ...c, [k]: v });

  async function save() {
    setBusy(true); setMsg(null);
    const payload = { first_name: c.first_name, middle_name: nz(c.middle_name), last_name: nz(c.last_name), email: nz(c.email), phone: nz(c.phone), linkedin_url: nz(c.linkedin_url) };
    const res = id ? await supabase.from('contact').update(payload).eq('id', id).select('id').single() : await supabase.from('contact').insert(payload).select('id').single();
    if (res.error) { setMsg(res.error.message.includes('contact_linkedin_uq') ? 'LinkedIn-profilen findes allerede hos en anden person.' : res.error.message); setBusy(false); return; }
    const cid = res.data.id as string;
    const rr = await supabase.from('contact_relation').upsert({ contact_id: cid, acquaintance_id: rel.acquaintance_id || null, mobile: nz(rel.mobile), notes: nz(rel.notes) }, { onConflict: 'owner_id,contact_id' });
    setBusy(false);
    if (rr.error) { setMsg(rr.error.message); return; }
    go('person', cid);
    setEdit(false); setF(null); setR(null); reload();
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
          <h2>Kun synligt for dig</h2>
          <div className="grid">
            <Field label="Mobil (privat)"><input value={rel.mobile ?? ''} onChange={(e) => setR({ ...rel, mobile: e.target.value })} /></Field>
            <Field label="Kendskab"><select value={rel.acquaintance_id ?? ''} onChange={(e) => setR({ ...rel, acquaintance_id: e.target.value || null })}><option value="">Ikke angivet</option>{lk.data?.acquaintance.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <Field label="Noter (private)" wide><textarea rows={5} value={rel.notes ?? ''} onChange={(e) => setR({ ...rel, notes: e.target.value })} /></Field>
          </div>
          <div className="bar">
            <button className="btn" disabled={busy || !c.first_name.trim()} onClick={save}>Gem</button>
            <button className="btn ghost" onClick={() => (id ? (setEdit(false), setF(null), setR(null)) : go('personer'))}>Annuller</button>
            <span className="grow" />
            {id && <button className="btn ghost" onClick={del}>Slet</button>}
          </div>
        </>
      ) : (
        <>
          <div className="bar"><button className="btn ghost sm" onClick={() => setEdit(true)}>Redigér</button></div>
          <div className="row2">
            <div className="panel"><h2>Privat</h2>
              <p>{rel.mobile ? <>Mobil {rel.mobile}</> : <span className="mute">Intet mobilnummer</span>}</p>
              {rel.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{rel.notes}</p> : <p className="mute">Ingen noter</p>}
            </div>
          </div>
        </>
      )}
      {id && <Affiliations contactId={id} cur={cur} past={past} onChange={reload} />}
    </>
  );
}

function Affiliations({ contactId, cur, past, onChange }: { contactId: string; cur: Aff[]; past: Aff[]; onChange: () => void }) {
  const lk = useLookups(); const co = useCompanyOpts();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [typ, setTyp] = useState(''); const [title, setTitle] = useState('');
  const [lv, setLv] = useState<string[]>([]); const [prim, setPrim] = useState(cur.length === 0);
  const [msg, setMsg] = useState<string | null>(null);
  async function add() {
    const company = findCompany(co.data ?? [], name);
    if (!company) { setMsg('Vælg en virksomhed fra listen. Opret den først, hvis den ikke findes.'); return; }
    const type = typ || lk.data?.affiliation_type[0]?.id;
    if (prim) await supabase.from('contact_company').update({ is_primary: false }).eq('contact_id', contactId).eq('is_primary', true);
    const x = await supabase.from('contact_company').insert({ contact_id: contactId, company_id: company.id, affiliation_type_id: type, title: title.trim() || null, is_primary: prim }).select('id').single();
    if (x.error) { setMsg(x.error.message); return; }
    if (lv.length) { const y = await supabase.from('contact_company_level').insert(lv.map((level_id) => ({ contact_company_id: x.data.id, level_id }))); if (y.error) { setMsg(y.error.message); return; } }
    setOpen(false); setName(''); setTitle(''); setLv([]); setMsg(null); onChange();
  }
  const end = async (a: Aff) => { await supabase.from('contact_company').update({ end_date: new Date().toISOString().slice(0, 10), is_primary: false }).eq('id', a.id); onChange(); };
  const rm = async (a: Aff) => { if (confirm('Fjern tilknytningen?')) { await supabase.from('contact_company').delete().eq('id', a.id); onChange(); } };
  const row = (a: Aff, active: boolean) => (
    <li key={a.id}>
      <span className="grow"><Link view="virksomhed" id={a.company_id}>{a.company?.name}</Link>{a.is_primary && active && <span className="tag" style={{ marginLeft: 8 }}>Primær</span>}
        <div className="mute">{[a.title, a.affiliation_type?.name].filter(Boolean).join(' · ')}</div></span>
      <span>{a.contact_company_level.map((l) => l.level && <span className="tag" key={l.level.name}>{l.level.name}</span>)}</span>
      {active && <button className="btn ghost sm" onClick={() => end(a)}>Afslut</button>}
      <button className="btn ghost sm" onClick={() => rm(a)}>Fjern</button>
    </li>
  );
  return (
    <>
      <h2>Tilknytninger</h2>
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
            <label className="check"><input type="checkbox" checked={prim} onChange={(e) => setPrim(e.target.checked)} /> Primær tilknytning</label>
          </div>
          <div className="bar"><button className="btn" onClick={add}>Tilføj</button><button className="btn ghost" onClick={() => setOpen(false)}>Annuller</button></div>
        </div>
      ) : <div className="bar"><button className="btn ghost sm" onClick={() => setOpen(true)}>Tilføj tilknytning</button></div>}
    </>
  );
}
