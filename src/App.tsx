import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useRoute } from './lib/nav';
import { Link, Err, useTheme } from './lib/ui';
import Persons from './pages/Persons';
import Person from './pages/Person';
import Companies from './pages/Companies';
import Company from './pages/Company';
import Cleanup from './pages/Cleanup';
import Activities from './pages/Activities';
import Activity from './pages/Activity';
import Admin from './pages/Admin';

function Login() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [msg, setMsg] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setMsg('Forkert e-mail eller adgangskode.');
  }
  return (
    <div className="login">
      <h1>PONTIFEX<span style={{ color: 'var(--red)' }}>.</span></h1>
      <p className="sub">Log ind for at fortsætte.</p>
      <form onSubmit={go}>
        <Err msg={msg} />
        <input type="email" autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" autoComplete="current-password" placeholder="Adgangskode" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <button className="btn">Log ind</button>
      </form>
    </div>
  );
}

const NAV: [string, string, string[]][] = [['personer', 'Personer', ['personer', 'person', 'person-ny']], ['virksomheder', 'Virksomheder', ['virksomheder', 'virksomhed', 'virksomhed-ny']], ['aktiviteter', 'Aktiviteter', ['aktiviteter', 'aktivitet', 'aktivitet-ny']], ['oprydning', 'Oprydning', ['oprydning']], ['admin', 'Admin', ['admin']]];

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [active, setActive] = useState<boolean | null>(null);
  const [theme, toggle] = useTheme();
  const r = useRoute();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setActive(null); return; }
    supabase.from('app_user').select('active').eq('user_id', session.user.id).maybeSingle().then(({ data }) => setActive(!!data?.active));
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (active === null) return null;
  if (!active) return <div className="login"><h1>Afventer</h1><p className="sub">Din konto er oprettet, men ikke aktiveret endnu. Bed ejeren om adgang.</p><button className="btn ghost" onClick={() => supabase.auth.signOut()}>Log ud</button></div>;

  let page;
  switch (r.view) {
    case 'person': page = <Person key={r.id} id={r.id} />; break;
    case 'person-ny': page = <Person key="new" id={null} />; break;
    case 'virksomheder': page = <Companies />; break;
    case 'virksomhed': page = <Company key={r.id} id={r.id} />; break;
    case 'virksomhed-ny': page = <Company key="new" id={null} />; break;
    case 'aktiviteter': page = <Activities />; break;
    case 'aktivitet': page = <Activity key={r.id} id={r.id} />; break;
    case 'aktivitet-ny': page = <Activity key="new" id={null} />; break;
    case 'admin': page = <Admin />; break;
    case 'oprydning': page = <Cleanup />; break;
    default: page = <Persons />;
  }
  return (
    <div className="shell">
      <nav className="rail" aria-label="Hovedmenu">
        <div className="mark">PONTIFEX<i>.</i></div>
        {NAV.map(([v, l, set]) => <Link key={v} view={v} className={'nav' + (set.includes(r.view) ? ' on' : '')}>{l}</Link>)}
        <span className="sp" />
        <button className="btn ghost sm" onClick={toggle}>{theme === 'dark' ? 'Lys tilstand' : 'Mørk tilstand'}</button>
        <button className="btn ghost sm" onClick={() => supabase.auth.signOut()}>Log ud</button>
      </nav>
      <main className="main">{page}</main>
      <nav className="tabbar" aria-label="Hovedmenu">
        {NAV.map(([v, l, set]) => <Link key={v} view={v} className={set.includes(r.view) ? 'on' : ''}>{l}</Link>)}
        <a href="#" onClick={(e) => { e.preventDefault(); toggle(); }}>{theme === 'dark' ? 'Lys' : 'Mørk'}</a>
        <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut(); }}>Log ud</a>
      </nav>
    </div>
  );
}
