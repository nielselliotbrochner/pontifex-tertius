import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { go } from '../lib/nav';
import { Link, Err, Field, fullName } from '../lib/ui';
import { useLookups } from '../lib/lookups';
import { CompanyPick, findCompany, useCompanyOpts } from '../lib/CompanyPick';

type Co = { id: string; name: string; cvr: string | null; website: string | null; type_id: string | null; sector_id: string | null };
type Own = { id: string; owner_company_id: string; owned_company_id: string; share_pct: number | null; is_main: boolean };
type Member = { id: string; title: string | null; start_date: string | null; end_date: string | null; contact: { id: string; first_name: string; middle_name: string | null; last_name: string | null } | null; contact_company_level: { level: { name: string } | null }[] };
const nz = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const blank: Co = { id: '', name: '', cvr: '', website: '', type_id: null, sector_id: null };

type CAct = { id: string; occurred_on: string; title: string; type: { name: string } | null };
const yr = (d: string | null) => (d ? d.slice(0, 4) : '');
const period = (m: { start_date: string | null; end_date: string | null }) => (m.end_date ? `${yr(m.start_date) || '?'} til ${yr(m.end_date)}` : m.start_date ? `Siden ${yr(m.start_date)}` : '');
const ActList = ({ items }: { items: CAct[] }) => <ul className="list">{items.map((a) => <li key={a.id}><span className="mute" style={{ minWidth: 92 }}>{a.occurred_on}</span><span className="grow"><Link view="aktivitet" id={a.id}>{a.title}</Link></span><span className="tag">{a.type?.name}</span></li>)}</ul>;

export default function Company({ id }: { id: string | null }) {
  const lk = useLookups(); const opts = useCompanyOpts();
  const { data, error, loading, reload } = useAsync(async () => {
    const all = await supabase.from('company_ownership').select('id,owner_company_id,owned_company_id,share_pct,is_main').limit(20000);
    if (all.error) throw all.error;
    const brs = await supabase.from('branch').select('id,name').eq('active', true).order('sort_order');
    if (brs.error) throw brs.error;
    const br = brs.data as { id: string; name: string }[];
    if (!id) return { co: blank, own: all.data as Own[], members: [] as Member[], acts: [] as CAct[], mentioned: [] as CAct[], br, mine: [] as string[] };
    const [co, mem, pa, ac, mb] = await Promise.all([
      supabase.from('company').select('id,name,cvr,website,type_id,sector_id').eq('id', id).single(),
      supabase.from('contact_company').select('id,title,start_date,end_date,contact(id,first_name,middle_name,last_name),contact_company_level(level(name))').eq('company_id', id).order('end_date', { ascending: false, nullsFirst: true }).order('start_date', { ascending: false, nullsFirst: false }),
      supabase.from('activity_participant').select('activity(id,occurred_on,title,type:activity_type(name))').eq('company_id', id),
      supabase.from('activity_company').select('activity(id,occurred_on,title,type:activity_type(name))').eq('company_id', id),
      supabase.from('company_branch').select('branch_id').eq('company_id', id),
    ]);
    if (co.error) throw co.error;
    const flat = (d: unknown): CAct[] => { const m = new Map<string, CAct>(); for (const x of (d ?? []) as { activity: CAct | null }[]) if (x.activity) m.set(x.activity.id, x.activity); return [...m.values()].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)); };
    return { co: co.data as Co, own: all.data as Own[], members: (mem.data ?? []) as unknown as Member[], acts: flat(pa.data), mentioned: flat(ac.data), br, mine: ((mb.data ?? []) as { branch_id: string }[]).map((x) => x.branch_id) };
  }, [id]);
  const [edit, setEdit] = useState(!id);
  const [f, setF] = useState<Co | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [bsel, setBsel] = useState<string[] | null>(null);
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
    const cid = res.data.id as string; const want = bsel ?? data.mine;
    const rem = data.mine.filter((b) => !want.includes(b)); const add = want.filter((b) => !data.mine.includes(b));
    if (rem.length) { const d = await supabase.from('company_branch').delete().eq('company_id', cid).in('branch_id', rem); if (d.error) { setMsg(d.error.message); return; } }
    if (add.length) { const i = await supabase.from('company_branch').insert(add.map((branch_id) => ({ company_id: cid, branch_id }))); if (i.error) { setMsg(i.error.message); return; } }
    setEdit(false); setF(null); setBsel(null); reload(); go('virksomhed', cid);
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
      <li key={o.id}>{o.owned_company_id === id ? <b>{nameOf(o.owned_company_id)}</b> : <Link view="virksomhed" id={o.owned_company_id}>{nameOf(o.owned_company_id)}</Link>}{' '}
        <span className="mute">{o.share_pct != null ? o.share_pct + ' %' : 'ejerandel ukendt'}{o.is_main ? '' : ' · ikke hovedejer'}</span>
        <Tree cid={o.owned_company_id} depth={depth + 1} /></li>))}</ul>;
  };

  const up = new Map<string, string>();
  for (const o of data.own) if (!up.has(o.owned_company_id) || o.is_main) up.set(o.owned_company_id, o.owner_company_id);
  let root = id ?? ''; { const seen = new Set<string>([root]); while (up.has(root)) { const n = up.get(root)!; if (seen.has(n)) break; seen.add(n); root = n; } }
  const inGroup = !!id && (root !== id || kids(id).length > 0);
  const countIn = (cid: string, seen = new Set<string>()): number => { if (seen.has(cid)) return 0; seen.add(cid); return 1 + kids(cid).reduce((n, o) => n + countIn(o.owned_company_id, seen), 0); };
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
          <h2>Brancher</h2>
          <p className="mute" style={{ marginTop: 0 }}>En virksomhed kan have flere.</p>
          <div>{data.br.map((b) => { const cur = bsel ?? data.mine; return <label className="check" key={b.id} style={{ display: 'inline-flex', marginRight: 16 }}>
            <input type="checkbox" checked={cur.includes(b.id)} onChange={(e) => setBsel(e.target.checked ? [...cur, b.id] : cur.filter((x) => x !== b.id))} />{b.name}</label>; })}</div>
          <div className="bar">
            <button className="btn" disabled={!c.name.trim()} onClick={save}>Gem</button>
            <button className="btn ghost" onClick={() => (id ? (setEdit(false), setF(null), setBsel(null)) : go('virksomheder'))}>Annuller</button>
            <span className="grow" />{id && <button className="btn ghost" onClick={del}>Slet</button>}
          </div>
        </>
      ) : (
        <>
          <p className="sub">{[lk.data?.company_type.find((o) => o.id === data.co.type_id)?.name, data.co.cvr && 'CVR ' + data.co.cvr].filter(Boolean).join(' · ')}
            {data.co.website && <> · <a href={/^https?:/.test(data.co.website) ? data.co.website : 'https://' + data.co.website} target="_blank" rel="noopener noreferrer">{data.co.website}</a></>}</p>
          <div className="bar"><button className="btn ghost sm" onClick={() => setEdit(true)}>Redigér</button></div>
          {id && <Branches cid={id} />}
        </>
      )}
      {id && (
        <>
          <div className="row2">
            <div><h2>Ejes af</h2><Owners id={id} owners={owners} nameOf={nameOf} options={opts.data ?? []} onChange={() => { reload(); }} /></div>
            <div><h2>Ejer</h2>{kids(id).length ? <Tree cid={id} depth={0} /> : <p className="mute">Ejer ingen virksomheder.</p>}</div>
          </div>
          {inGroup && (
            <>
              <h2>Koncern · {countIn(root)} selskaber</h2>
              <p className="mute">Alle selskaber under samme øverste ejer. {root === id ? 'Dette selskab er øverst.' : 'Dette selskab står med fed.'}</p>
              <ul className="tree root"><li>{root === id ? <b>{nameOf(root)}</b> : <Link view="virksomhed" id={root}>{nameOf(root)}</Link>}<Tree cid={root} depth={1} /></li></ul>
            </>
          )}
          <h2>Personer</h2>
          {(() => {
            const row = (m: Member) => m.contact && (
              <li key={m.id}><span className="grow"><Link view="person" id={m.contact.id}>{fullName(m.contact)}</Link><div className="mute">{m.title}</div></span>
                <span>{m.contact_company_level.map((l) => l.level && <span className="tag" key={l.level.name}>{l.level.name}</span>)}</span>
                <span className="mute" style={{ minWidth: 92, textAlign: 'right' }}>{period(m)}</span></li>);
            const act = data.members.filter((m) => !m.end_date); const old = data.members.filter((m) => m.end_date);
            return (<>
              {act.length === 0 ? <p className="mute">Ingen aktive personer.</p> : <ul className="list">{act.map(row)}</ul>}
              {old.length > 0 && <><h2>Tidligere ansatte og tilknyttede</h2><ul className="list">{old.map(row)}</ul></>}
            </>);
          })()}
          <h2>Aktiviteter</h2>
          {data.acts.length === 0 ? <p className="mute">Ingen aktiviteter.</p> : <ActList items={data.acts} />}
          {data.mentioned.length > 0 && (<><h2>Omtalt i</h2><ActList items={data.mentioned} /></>)}
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

function Branches({ cid }: { cid: string }) {
  const { data, reload } = useAsync(async () => {
    const [b, m] = await Promise.all([
      supabase.from('branch').select('id,name').eq('active', true).order('sort_order'),
      supabase.from('company_branch').select('branch_id').eq('company_id', cid),
    ]);
    if (b.error) throw b.error; if (m.error) throw m.error;
    return { all: b.data as { id: string; name: string }[], mine: (m.data as { branch_id: string }[]).map((x) => x.branch_id) };
  }, [cid]);
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  if (!data) return null;
  const toggle = async (bid: string) => {
    setMsg(null);
    const r = data.mine.includes(bid) ? await supabase.from('company_branch').delete().eq('company_id', cid).eq('branch_id', bid) : await supabase.from('company_branch').insert({ company_id: cid, branch_id: bid });
    if (r.error) setMsg(r.error.message); reload();
  };
  const mine = data.all.filter((b) => data.mine.includes(b.id));
  return (
    <>
      <h2>Brancher</h2>
      <Err msg={msg} />
      <div className="bar">
        {mine.length === 0 && !open && <span className="mute">Ingen brancher valgt.</span>}
        {!open && mine.map((b) => <span className="tag" key={b.id}>{b.name}</span>)}
        {open && data.all.map((b) => <label className="check" key={b.id} style={{ display: 'inline-flex', marginRight: 16 }}><input type="checkbox" checked={data.mine.includes(b.id)} onChange={() => toggle(b.id)} />{b.name}</label>)}
        <button className="btn ghost sm" onClick={() => setOpen(!open)}>{open ? 'Færdig' : 'Redigér brancher'}</button>
      </div>
    </>
  );
}
