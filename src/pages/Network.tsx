import { useEffect, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type Simulation } from 'd3-force';
import { supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { fetchAll } from '../lib/fetchAll';
import { Link, Err, fullName } from '../lib/ui';
import { buildGraph, KINDS, type GEdge, type GNode, type Kind, type Raw } from '../lib/graph';

type Ov = { contact_id: string; first_name: string; middle_name: string | null; last_name: string | null; company_name: string | null; rank: number | null; is_decision_maker: boolean | null };
const ALL: Record<Kind, boolean> = { current: true, former: true, together: true, mentionedPerson: true, mentionedCompany: true };
const NONE: Record<Kind, boolean> = { current: false, former: false, together: false, mentionedPerson: false, mentionedCompany: false };
const radius = (n: GNode) => (n.type === 'c' ? 8 : n.dm ? 7 : 5);
const kindIdx = (k: Kind) => KINDS.findIndex((x) => x.k === k);

export default function Network() {
  const { data: raw, error, loading } = useAsync<Raw>(async () => {
    const [p, c, a, pa, su, ac] = await Promise.all([
      fetchAll<Ov>((f, t) => supabase.from('v_contact_overview').select('contact_id,first_name,middle_name,last_name,company_name,rank,is_decision_maker').eq('active', true).order('contact_id').range(f, t)),
      fetchAll<{ id: string; name: string }>((f, t) => supabase.from('company').select('id,name').order('id').range(f, t)),
      fetchAll<Raw['affs'][number]>((f, t) => supabase.from('contact_company').select('contact_id,company_id,end_date').order('id').range(f, t)),
      fetchAll<Raw['parts'][number]>((f, t) => supabase.from('activity_participant').select('activity_id,contact_id').order('activity_id').order('contact_id').range(f, t)),
      fetchAll<Raw['subjects'][number]>((f, t) => supabase.from('activity_subject').select('activity_id,contact_id').order('activity_id').order('contact_id').range(f, t)),
      fetchAll<Raw['acos'][number]>((f, t) => supabase.from('activity_company').select('activity_id,company_id').order('activity_id').order('company_id').range(f, t)),
    ]);
    return { persons: p.map((x) => ({ id: x.contact_id, name: fullName(x), company: x.company_name, rank: x.rank, dm: !!x.is_decision_maker })), companies: c, affs: a, parts: pa, subjects: su, acos: ac };
  }, [], 'network');

  const [on, setOn] = useState<Record<Kind, boolean>>(ALL);
  const [dmOnly, setDmOnly] = useState(false); const [isolated, setIsolated] = useState(false);
  const [sel, setSel] = useState<string | null>(null); const [hover, setHover] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { current: 0, former: 0, together: 0, mentionedPerson: 0, mentionedCompany: 0 };
    if (!raw) return c;
    for (const e of buildGraph(raw, ALL, { dmOnly, isolated: false }).edges) c[e.kind]++;
    return c;
  }, [raw, dmOnly]);
  const graph = useMemo(() => (raw ? buildGraph(raw, on, { dmOnly, isolated }) : { nodes: [] as GNode[], edges: [] as GEdge[] }), [raw, on, dmOnly, isolated]);

  // størrelse og visning
  const wrap = useRef<HTMLDivElement>(null); const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [t, setT] = useState({ x: 0, y: 0, k: 1 }); const tRef = useRef(t); tRef.current = t;
  const autoFit = useRef(true); const [, setFrame] = useState(0);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); return () => ro.disconnect(); }, []);

  const pos = useRef(new Map<string, { x: number; y: number }>());
  const sim = useRef<Simulation<GNode, GEdge> | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const sizeRef = useRef(size); sizeRef.current = size;
  const fit = () => {
    const ns = nodesRef.current; if (!ns.length) return;
    const xs = ns.map((n) => n.x ?? 0), ys = ns.map((n) => n.y ?? 0);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const { w, h } = sizeRef.current; const k = Math.max(0.2, Math.min(2, Math.min(w / (x1 - x0 + 120), h / (y1 - y0 + 120))));
    setT({ k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k });
  };
  useEffect(() => {
    const nodes = graph.nodes; nodesRef.current = nodes;
    nodes.forEach((n, i) => { const p = pos.current.get(n.id); if (p) { n.x = p.x; n.y = p.y; } else { const a = i * 2.4; n.x = Math.cos(a) * (20 + i * 3); n.y = Math.sin(a) * (20 + i * 3); } });
    const s = forceSimulation<GNode>(nodes)
      .force('link', forceLink<GNode, GEdge>(graph.edges).id((n) => n.id).distance((e) => (e.kind === 'current' || e.kind === 'former' ? 46 : 80)).strength(0.5))
      .force('charge', forceManyBody().strength(-70))
      .force('center', forceCenter(0, 0).strength(0.05))
      .force('collide', forceCollide<GNode>((n) => radius(n) + 5))
      .alphaDecay(0.035);
    let ticks = 0; autoFit.current = true;
    s.on('tick', () => { ticks++; nodes.forEach((n) => pos.current.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })); if (ticks % 2 === 0) setFrame((f) => f + 1); if (autoFit.current && (ticks === 30 || ticks === 90)) fit(); });
    s.on('end', () => { setFrame((f) => f + 1); if (autoFit.current) fit(); });
    sim.current = s;
    return () => { s.stop(); };
  }, [graph]);
  useEffect(() => { if (sel && !graph.nodes.some((n) => n.id === sel)) setSel(null); }, [graph, sel]);

  // zoom og træk
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); autoFit.current = false;
      const r = el.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top; const c = tRef.current;
      const k = Math.max(0.15, Math.min(6, c.k * Math.exp(-e.deltaY * 0.0015)));
      setT({ k, x: px - ((px - c.x) / c.k) * k, y: py - ((py - c.y) / c.k) * k });
    };
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel);
  }, []);
  const drag = useRef<{ node: GNode | null; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const toGraph = (e: React.PointerEvent) => { const r = svg.current!.getBoundingClientRect(); const c = tRef.current; return { x: (e.clientX - r.left - c.x) / c.k, y: (e.clientY - r.top - c.y) / c.k }; };
  const down = (e: React.PointerEvent) => {
    const id = (e.target as Element).closest('[data-node]')?.getAttribute('data-node');
    const node = id ? nodesRef.current.find((n) => n.id === id) ?? null : null;
    drag.current = { node, sx: e.clientX, sy: e.clientY, ox: tRef.current.x, oy: tRef.current.y, moved: false };
    svg.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    autoFit.current = false;
    if (d.node) { const g = toGraph(e); d.node.fx = g.x; d.node.fy = g.y; sim.current?.alphaTarget(0.25).restart(); }
    else setT({ ...tRef.current, x: d.ox + dx, y: d.oy + dy });
  };
  const up = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    if (d.node) { d.node.fx = null; d.node.fy = null; sim.current?.alphaTarget(0); if (!d.moved) setSel((s) => (s === d.node!.id ? null : d.node!.id)); }
    else if (!d.moved) setSel(null);
  };
  const zoomBy = (f: number) => { autoFit.current = false; const c = tRef.current; const { w, h } = size; const k = Math.max(0.15, Math.min(6, c.k * f)); setT({ k, x: w / 2 - ((w / 2 - c.x) / c.k) * k, y: h / 2 - ((h / 2 - c.y) / c.k) * k }); };

  // markering
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const adj = useMemo(() => { const m = new Map<string, Set<string>>(); for (const e of graph.edges) { const a = (e.a), b = (e.b); (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b); (m.get(b) ?? m.set(b, new Set()).get(b)!).add(a); } return m; }, [graph]);
  const focus = sel ?? hover; const near = focus ? adj.get(focus) : null;
  const dim = (id: string) => !!focus && id !== focus && !near?.has(id);
  const showLabel = (n: GNode) => n.id === sel || n.id === hover || (!!near?.has(n.id) && !!focus) || graph.nodes.length <= 60 || t.k > 1.8 || (n.type === 'c' && t.k > 0.7);

  const pickPerson = (v: string) => { setQ(v); const p = raw?.persons.find((x) => x.company ? `${x.name} · ${x.company}` === v : x.name === v); if (p) { const id = 'p:' + p.id; if (!byId.has(id)) setIsolated(true); setSel(id); setQ(''); } };
  const toggle = (k: Kind) => setOn({ ...on, [k]: !on[k] });
  const nP = graph.nodes.filter((n) => n.type === 'p').length, nC = graph.nodes.length - nP;

  const path = (e: GEdge) => {
    const s = e.source as GNode, tg = e.target as GNode; if (typeof s === 'string' || typeof tg === 'string') return null;
    const sx = s.x ?? 0, sy = s.y ?? 0, tx = tg.x ?? 0, ty = tg.y ?? 0; const dx = tx - sx, dy = ty - sy; const len = Math.hypot(dx, dy) || 1;
    const dir = KINDS[kindIdx(e.kind)].directed; const rr = radius(tg) + (dir ? 3 : 0);
    const ex = tx - (dx / len) * rr, ey = ty - (dy / len) * rr; const off = (kindIdx(e.kind) - 2) * 4;
    const cx = (sx + ex) / 2 + (-dy / len) * off, cy = (sy + ey) / 2 + (dx / len) * off;
    return `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`;
  };

  return (
    <>
      <h1>Netværk</h1>
      <p className="sub">Tænd og sluk relationer for at finde sammenhænge og nye veje ind. Klik på en person eller virksomhed for at se forbindelserne.</p>
      <Err msg={error} />
      <div className="net">
        <aside className="netside">
          <h2>Relationer</h2>
          <ul className="legend">{KINDS.map((x) => (
            <li key={x.k}>
              <label className="check" title={x.hint}>
                <input type="checkbox" checked={on[x.k]} onChange={() => toggle(x.k)} />
                <svg width="38" height="12" aria-hidden="true"><line x1="2" y1="6" x2="30" y2="6" className={'ln e-' + x.k} />{x.directed && <path d="M36,6 L29,2.5 L29,9.5 Z" className={'ar a-' + x.k} />}</svg>
                <span className="grow">{x.label}</span><span className="mute">{counts[x.k]}</span>
              </label>
            </li>))}</ul>
          <div className="bar">
            <button className="btn ghost sm" onClick={() => setOn(ALL)}>Alle</button>
            <button className="btn ghost sm" onClick={() => setOn({ ...NONE, current: true, former: true })}>Virksomhed</button>
            <button className="btn ghost sm" onClick={() => setOn({ ...NONE, mentionedPerson: true, mentionedCompany: true })}>Omtale</button>
            <button className="btn ghost sm" onClick={() => setOn(NONE)}>Ingen</button>
          </div>
          <h2>Filter</h2>
          <label className="check"><input type="checkbox" checked={dmOnly} onChange={(e) => setDmOnly(e.target.checked)} /> Kun beslutningstagere</label>
          <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={isolated} onChange={(e) => setIsolated(e.target.checked)} /> Vis personer uden relationer</label>
          <div className="bar"><input className="grow" list="net-people" value={q} placeholder="Find person" onChange={(e) => pickPerson(e.target.value)} />
            <datalist id="net-people">{raw?.persons.map((p) => <option key={p.id} value={p.company ? `${p.name} · ${p.company}` : p.name} />)}</datalist></div>
          <h2>Tegn</h2>
          <ul className="legend key">
            <li><svg width="38" height="14"><circle cx="19" cy="7" r="5" className="np" /></svg> Person</li>
            <li><svg width="38" height="14"><circle cx="19" cy="7" r="6" className="np dmr" /></svg> Beslutningstager</li>
            <li><svg width="38" height="14"><rect x="13" y="1" width="12" height="12" className="nc" /></svg> Virksomhed</li>
            <li className="mute">Tykkere streg betyder flere forbindelser.</li>
          </ul>
        </aside>
        <div className="netmain">
          <div className="netstats mono">{nP} personer · {nC} virksomheder · {graph.edges.length} forbindelser</div>
          <div className="netwrap" ref={wrap}>
            <svg ref={svg} className="netsvg" width="100%" height="100%" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <defs>{KINDS.filter((x) => x.directed).map((x) => (
                <marker key={x.k} id={'m-' + x.k} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 Z" className={'ar a-' + x.k} /></marker>))}</defs>
              <g transform={`translate(${t.x + size.w * 0},${t.y}) scale(${t.k})`}>
                <g className="edges">{graph.edges.map((e) => { const d = path(e); if (!d) return null; const faded = !!focus && e.a !== focus && e.b !== focus;
                  return <path key={e.id} d={d} fill="none" className={'ln e-' + e.kind + (faded ? ' faded' : '')} style={{ strokeWidth: (1 + Math.min(e.w, 6) * 0.45) / Math.sqrt(t.k) }} markerEnd={KINDS[kindIdx(e.kind)].directed ? `url(#m-${e.kind})` : undefined}><title>{KINDS[kindIdx(e.kind)].label}{e.w > 1 ? ` (${e.w})` : ''}</title></path>; })}</g>
                <g className="nodes">{graph.nodes.map((n) => (
                  <g key={n.id} data-node={n.id} transform={`translate(${n.x ?? 0},${n.y ?? 0})`} className={'node' + (dim(n.id) ? ' faded' : '') + (n.id === sel ? ' sel' : '')} onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)}>
                    {n.type === 'c' ? <rect x={-7} y={-7} width={14} height={14} className="nc" /> : <circle r={radius(n)} className={'np' + (n.dm ? ' dmr' : '')} />}
                    {showLabel(n) && <text x={radius(n) + 4} y={3.5} className="nl" style={{ fontSize: 10 / Math.sqrt(t.k) }}>{n.label}</text>}
                  </g>))}</g>
              </g>
            </svg>
            <div className="netzoom"><button className="tb" onClick={() => zoomBy(1.4)} aria-label="Zoom ind">+</button><button className="tb" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom ud">−</button><button className="tb" onClick={() => { autoFit.current = true; fit(); }}>Tilpas</button></div>
            {!loading && graph.nodes.length === 0 && <div className="netempty mute">Ingen forbindelser med de valgte relationer.</div>}
            {loading && <div className="netempty mute">Henter</div>}
          </div>
          <Detail sel={sel ? byId.get(sel) ?? null : null} graph={graph} byId={byId} onSelect={setSel} />
        </div>
      </div>
    </>
  );
}

function Detail({ sel, graph, byId, onSelect }: { sel: GNode | null; graph: { nodes: GNode[]; edges: GEdge[] }; byId: Map<string, GNode>; onSelect: (id: string) => void }) {
  if (!sel) return <p className="mute">Vælg en person eller virksomhed i netværket for at se, hvordan vedkommende hænger sammen med de andre.</p>;
  const mine = graph.edges.filter((e) => e.a === sel.id || e.b === sel.id);
  const item = (id: string, extra?: string) => { const n = byId.get(id); return n ? <button key={id} className="chip" onClick={() => onSelect(id)}>{n.label}{extra ? <span className="mute"> {extra}</span> : null}</button> : null; };
  const rows: { title: string; k: Kind; ids: { id: string; x?: string }[] }[] = [];
  for (const kd of KINDS) {
    const es = mine.filter((e) => e.kind === kd.k);
    if (!es.length) continue;
    if (kd.directed) {
      const out = es.filter((e) => e.a === sel.id), inn = es.filter((e) => e.b === sel.id);
      const what = kd.k === 'mentionedPerson' ? 'person' : 'virksomhed';
      if (out.length) rows.push({ title: `Har omtalt ${what === 'person' ? 'personer' : 'virksomheder'}`, k: kd.k, ids: out.map((e) => ({ id: e.b, x: e.w > 1 ? `×${e.w}` : undefined })) });
      if (inn.length) rows.push({ title: sel.type === 'c' ? 'Omtalt af' : 'Omtalt af', k: kd.k, ids: inn.map((e) => ({ id: e.a, x: e.w > 1 ? `×${e.w}` : undefined })) });
    } else if (kd.k === 'current' || kd.k === 'former') {
      if (sel.type === 'p') {
        for (const e of es) {
          const cn = e.a === sel.id ? e.b : e.a;
          const others = graph.edges.filter((x) => (x.kind === 'current' || x.kind === 'former') && (x.a === cn || x.b === cn)).map((x) => ({ id: x.a === cn ? x.b : x.a, x: x.kind === 'former' ? 'tidligere' : undefined })).filter((x) => x.id !== sel.id);
          rows.push({ title: `${kd.label} · ${byId.get(cn)?.label ?? ''}`, k: kd.k, ids: others });
        }
      } else rows.push({ title: kd.label, k: kd.k, ids: es.map((e) => ({ id: e.a === sel.id ? e.b : e.a })) });
    } else rows.push({ title: kd.label, k: kd.k, ids: es.map((e) => ({ id: e.a === sel.id ? e.b : e.a, x: e.w > 1 ? `×${e.w}` : undefined })) });
  }
  return (
    <div className="netdetail">
      <h2>{sel.type === 'p' ? 'Person' : 'Virksomhed'}</h2>
      <div className="bar"><b>{sel.label}</b>{sel.dm && <span className="dm">Beslutningstager</span>}{sel.sub && <span className="mute">{sel.sub}</span>}
        <span className="grow" /><Link view={sel.type === 'p' ? 'person' : 'virksomhed'} id={sel.ref} className="btn ghost sm">Åbn</Link></div>
      {rows.length === 0 && <p className="mute">Ingen forbindelser med de valgte relationer.</p>}
      {rows.map((r, i) => (
        <div key={i} className="grp"><div className="gh"><svg width="30" height="10" aria-hidden="true"><line x1="1" y1="5" x2="29" y2="5" className={'ln e-' + r.k} /></svg><span className="mono">{r.title}</span></div>
          <div>{r.ids.length ? r.ids.map((x) => item(x.id, x.x)) : <span className="mute">Ingen andre</span>}</div></div>))}
    </div>
  );
}
