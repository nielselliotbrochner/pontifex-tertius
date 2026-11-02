import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { Link, Empty, Err } from '../lib/ui';

type Row = { id: string; text: string; due_on: string | null; done_at: string | null; assigned_to: string | null; activity: { id: string; title: string; occurred_on: string } | null };
type U = { user_id: string; display_name: string | null };
const today = () => new Date().toISOString().slice(0, 10);

export default function Followups() {
  const { data, error, loading, reload } = useAsync(async () => {
    const [f, u, me] = await Promise.all([
      supabase.from('activity_followup').select('id,text,due_on,done_at,assigned_to,activity(id,title,occurred_on)').order('due_on', { ascending: true, nullsFirst: false }).limit(5000),
      supabase.from('app_user').select('user_id,display_name').eq('active', true),
      supabase.auth.getUser(),
    ]);
    if (f.error) throw f.error;
    return { rows: f.data as unknown as Row[], users: (u.data ?? []) as U[], me: me.data.user?.id ?? null };
  }, [], 'followups');
  const [scope, setScope] = useState<'mine' | 'all'>('mine'); const [show, setShow] = useState<'open' | 'done'>('open');
  const [msg, setMsg] = useState<string | null>(null);
  const name = (id: string | null) => data?.users.find((x) => x.user_id === id)?.display_name ?? '';
  const t = today();
  const rows = useMemo(() => (data?.rows ?? [])
    .filter((r) => (show === 'open' ? !r.done_at : !!r.done_at) && (scope === 'all' || r.assigned_to === data?.me))
    .sort((a, b) => show === 'done' ? (b.done_at ?? '').localeCompare(a.done_at ?? '') : (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999')), [data, scope, show]);
  const open = (data?.rows ?? []).filter((r) => !r.done_at && (scope === 'all' || r.assigned_to === data?.me));
  const overdue = open.filter((r) => r.due_on && r.due_on < t).length;

  async function toggle(r: Row) {
    setMsg(null);
    const x = await supabase.from('activity_followup').update({ done_at: r.done_at ? null : new Date().toISOString() }).eq('id', r.id);
    if (x.error) setMsg(x.error.message); else reload();
  }
  async function assign(r: Row, uid: string) {
    const x = await supabase.from('activity_followup').update({ assigned_to: uid || null }).eq('id', r.id);
    if (x.error) setMsg(x.error.message); else reload();
  }
  return (
    <>
      <h1>Opfølgning</h1>
      <p className="sub">Opfølgninger fra dine aktiviteter. Tilføj nye på selve aktiviteten.</p>
      <div className="kpis"><div><b>{open.length}</b><span>åbne</span></div><div><b style={overdue ? { color: 'var(--red)' } : undefined}>{overdue}</b><span>forfaldne</span></div></div>
      <div className="bar">
        <button className={'btn sm ' + (scope === 'mine' ? '' : 'ghost')} onClick={() => setScope('mine')}>Mine</button>
        <button className={'btn sm ' + (scope === 'all' ? '' : 'ghost')} onClick={() => setScope('all')}>Alle</button>
        <span className="grow" />
        <button className={'btn sm ' + (show === 'open' ? '' : 'ghost')} onClick={() => setShow('open')}>Åbne</button>
        <button className={'btn sm ' + (show === 'done' ? '' : 'ghost')} onClick={() => setShow('done')}>Lukkede</button>
      </div>
      <Err msg={error ?? msg} />
      {loading && <p className="mute">Henter</p>}
      {!loading && !error && rows.length === 0 && <Empty title={show === 'open' ? 'Ingen åbne opfølgninger' : 'Ingen lukkede opfølgninger'} text={show === 'open' ? 'Tilføj opfølgninger nederst på en aktivitet.' : 'Luk en opfølgning ved at sætte hak.'} />}
      {rows.length > 0 && (
        <ul className="list">{rows.map((r) => {
          const late = !r.done_at && r.due_on && r.due_on < t;
          return (
            <li key={r.id}>
              <label className="check grow" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={!!r.done_at} onChange={() => toggle(r)} aria-label="Luk opfølgning" style={{ marginTop: 4 }} />
                <span><span style={r.done_at ? { textDecoration: 'line-through' } : undefined}>{r.text}</span>
                  {r.activity && <div className="mute"><Link view="aktivitet" id={r.activity.id}>{r.activity.title}</Link> · {r.activity.occurred_on}</div>}</span>
              </label>
              {r.due_on && <span className={late ? 'dm' : 'mute'}>{late ? 'Forfalden ' : ''}{r.due_on}</span>}
              {r.done_at ? <span className="mute">Lukket {r.done_at.slice(0, 10)}</span> : (
                <select value={r.assigned_to ?? ''} onChange={(e) => assign(r, e.target.value)} aria-label="Ansvarlig">
                  <option value="">Ingen</option>{data?.users.map((u) => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
                </select>)}
              {r.done_at && <span className="mute">{name(r.assigned_to)}</span>}
            </li>);
        })}</ul>
      )}
    </>
  );
}
