import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { go } from '../lib/nav';
import { Link, Err, Field, fullName } from '../lib/ui';
import { useLookups } from '../lib/lookups';
import { CompanyPick, findCompany, useCompanyOpts } from '../lib/CompanyPick';

type Co = { id: string; name: string; cvr: string | null; website: string | null; type_id: string | null; sector_id: string | null };
type Own = { id: string; owner_company_id: string; owned_company_id: string; share_pct: number | null; is_main: boolean };
type Member = { id: string; title: string | null; contact: { id: string; first_name: string; middle_name: string | null; last_name: string | null } | null; contact_company_level: { level: { name: string } | null }[] };
const nz = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const blank: Co = { id: '', name: '', cvr: '', website: '', type_id: null, sector_id: null };

export default function Company({ id }: { id: string | null }) {
  const lk = useLookups(); const opts = useCompanyOpts();
  const { data, error, loading, reload } = useAsync(async () => {
    const all = await supabase.from('company_ownership').select('id,owner_company_id,owned_company_id,share_pct,is_main').limit(20000);
    if (all.error) throw all.error;
    if (!id) return { co: blank, own: all.data as Own[], members: [] as Member[] };
    const [co, mem] = await Promise.all([
      supabase.from('company').select('id,name,cvr,website,type_id,sector_id').eq('id', id).single(),
      supabase.from('contact_company').select('id,title,contact(id,first_name,middle_name,last_name),contact_company_level(level(name))').eq('company_id', id).is('end_date', null),
    ]);
    if (co.error) throw co.error;
    return { co: co.data as Co, own: all.data as Own[], members: (mem.data ?? []) as unknown as Member[] };
  }, [id]);
  const [edit, setEdit] = useState(!id);
  const [f, setF] = useState<Co | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (error) return <Err msg={error} />;
  if (loading || !data) return <p className="mute">Henter</p>;
  const c = f ?? data.co;
  const set = (k: keyof Co, v: string | null) => setF({ ...c, [k]: v });
  const nameOf = (cid: string) => opts.data?.find((o) => o.id === cid)?.name ?? '…';

  async function save() {
    setMsg(null);
    const payload = { name: c.name.trim(), cvr: nz(c.cvr), website: nz(c.website), type_id: c.type_id || null, sector_id: c.sector_id || null };
    const res = id ? await supabase.from('company').update(payload).eq('id', id).select('id').single() : await supabase.from('company').insert(payload).select('id').single();
    if (res.error) { setMsg(res.error.message.includes('company_cvr_uq') ? 'CVR-nummeret findes allerede.' : res.error.message); return; }
    setEdit(false); setF(null); reload(); go('virksomhed', res.data.id as string);
  }
  async function del() {
    if (!id || !confirm('Slet virksomheden?')) return;
    const x = await supabase.from('company').delete().eq('id', id);
    if (x.error) setMsg(x.error.message.includes('violates') ? 'Virksomheden har tilknyttede personer. Fjern dem først.' : x.error.message); else go('virksomheder');
  }

  const owners = data.own.filter((o) => o.owned_company_id === id);
  const kids = (cid: string) => data.own.filter((o) => o.owner_company_id === cid);
  const Tree = ({ cid, depth }: { cid: string; depth: number }) => {
    const k = kids(cid);
    if (!k.length || depth > 10) return null;
    return <ul className={'tree' + (depth === 0 ? ' root' : '')}>{k.map((o) => (
      <li key={o.id}><Link view="virksomhed" id={o.owned_company_id}>{nameOf(o.owned_company_id)}</Link>{' '}
        <span className="mute">{o.share_pct != null ? o.share_pct + ' %' : 'ejerandel ukendt'}{o.is_main ? '' : ' · ikke hovedejer'}</span>
        <Tree cid={o.owned_company_id} depth={depth + 1} /></li>))}</ul>;
  };

  return (
    <>
      <Link view="virksomheder" className="mute">Virksomheder</Link>
      <h1>{id ? data.co.name : 'Ny virksomhed'}</h1>
      <Err msg={msg} />
      {edit ? (
        <>
          <div className="grid" style={{ marginTop: 16 }}>
            <Field label="Navn"><input value={c.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="CVR"><input inputMode="numeric" value={c.cvr ?? ''} onChange={(e) => set('cvr', e.target.value)} /></Field>
            <Field label="Hjemmeside"><input value={c.website ?? ''} onChange={(e) => set('website', e.target.value)} /></Field>
            <Field label="Type"><select value={c.type_id ?? ''} onChange={(e) => set('type_id', e.target.value || null)}><option value="">Ikke angivet</option>{lk.data?.company_type.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <Field label="Sektor"><select value={c.sector_id ?? ''} onChange={(e) => set('sector_id', e.target.value || null)}><option value="">Ikke angivet</option>{lk.data?.sector.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          </div>
          <div className="bar">
            <button className="btn" disabled={!c.name.trim()} onClick={save}>Gem</button>
            <button className="btn ghost" onClick={() => (id ? (setEdit(false), setF(null)) : go('virksomheder'))}>Annuller</button>
            <span className="grow" />{id && <button className="btn ghost" onClick={del}>Slet</button>}
          </div>
        </>
      ) : (
        <>
          <p className="sub">{[lk.data?.company_type.find((o) => o.id === data.co.type_id)?.name, data.co.cvr && 'CVR ' + data.co.cvr].filter(Boolean).join(' · ')}
            {data.co.website && <> · <a href={/^https?:/.test(data.co.website) ? data.co.website : 'https://' + data.co.website} target="_blank" rel="noopener noreferrer">{data.co.website}</a></>}</p>
          <div className="bar"><button className="btn ghost sm" onClick={() => setEdit(true)}>Redigér</button></div>
        </>
      )}
      {id && (
        <>
          <div className="row2">
            <div><h2>Ejes af</h2><Owners id={id} owners={owners} nameOf={nameOf} options={opts.data ?? []} onChange={() => { reload(); }} /></div>
            <div><h2>Ejer</h2>{kids(id).length ? <Tree cid={id} depth={0} /> : <p className="mute">Ejer ingen virksomheder.</p>}</div>
          </div>
          <h2>Personer</h2>
          {data.members.length === 0 ? <p className="mute">Ingen aktive personer.</p> : (
            <ul className="list">{data.members.map((m) => m.contact && (
              <li key={m.id}><span className="grow"><Link view="person" id={m.contact.id}>{fullName(m.contact)}</Link><div className="mute">{m.title}</div></span>
                <span>{m.contact_company_level.map((l) => l.level && <span className="tag" key={l.level.name}>{l.level.name}</span>)}</span></li>))}</ul>
          )}
        </>
      )}
    </>
  );
}

function Owners({ id, owners, nameOf, options, onChange }: { id: string; owners: Own[]; nameOf: (id: string) => string; options: { id: string; name: string }[]; onChange: () => void }) {
  const [name, setName] = useState(''); const [share, setShare] = useState(''); const [main, setMain] = useState(owners.length === 0);
  const [msg, setMsg] = useState<string | null>(null);
  async function add() {
    const o = findCompany(options, name);
    if (!o) { setMsg('Vælg en virksomhed fra listen.'); return; }
    if (main) await supabase.from('company_ownership').update({ is_main: false }).eq('owned_company_id', id).eq('is_main', true);
    const x = await supabase.from('company_ownership').insert({ owner_company_id: o.id, owned_company_id: id, share_pct: share ? Number(share.replace(',', '.')) : null, is_main: main });
    if (x.error) { setMsg(x.error.message); return; }
    setName(''); setShare(''); setMsg(null); onChange();
  }
  const makeMain = async (o: Own) => { await supabase.from('company_ownership').update({ is_main: false }).eq('owned_company_id', id); await supabase.from('company_ownership').update({ is_main: true }).eq('id', o.id); onChange(); };
  const rm = async (o: Own) => { await supabase.from('company_ownership').delete().eq('id', o.id); onChange(); };
  return (
    <>
      {owners.length === 0 && <p className="mute">Ingen ejere registreret.</p>}
      <ul className="list">{owners.map((o) => (
        <li key={o.id}><span className="grow"><Link view="virksomhed" id={o.owner_company_id}>{nameOf(o.owner_company_id)}</Link>
          <div className="mute">{o.share_pct != null ? o.share_pct + ' %' : 'ejerandel ukendt'}{o.is_main && ' · hovedejer'}</div></span>
          {!o.is_main && <button className="btn ghost sm" onClick={() => makeMain(o)}>Gør til hovedejer</button>}
          <button className="btn ghost sm" onClick={() => rm(o)}>Fjern</button></li>))}</ul>
      <Err msg={msg} />
      <div className="grid" style={{ marginTop: 12 }}>
        <Field label="Tilføj ejer"><CompanyPick value={name} onChange={setName} options={options.filter((o) => o.id !== id)} listId="co-own" /></Field>
        <Field label="Ejerandel i procent"><input inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} /></Field>
      </div>
      <div className="bar"><label className="check"><input type="checkbox" checked={main} onChange={(e) => setMain(e.target.checked)} /> Hovedejer</label><button className="btn ghost sm" onClick={add}>Tilføj</button></div>
    </>
  );
}
