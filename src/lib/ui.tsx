import { ReactNode, useEffect, useState } from 'react';
import { onLink, href } from './nav';

export function Link({ view, id, children, className }: { view: string; id?: string; children: ReactNode; className?: string }) {
  return <a className={className} href={href(view, id)} onClick={(e) => onLink(e, view, id)}>{children}</a>;
}
export function Empty({ title, text }: { title: string; text?: string }) {
  return <div className="empty"><strong>{title}</strong>{text && <p>{text}</p>}</div>;
}
export function Err({ msg }: { msg: string | null }) { return msg ? <div className="err" role="alert">{msg}</div> : null; }

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={'field' + (wide ? ' wide' : '')}><span>{label}</span>{children}</label>;
}

export function useTheme(): [string, () => void] {
  const sys = () => (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const [t, setT] = useState<string>(() => document.documentElement.dataset.theme || sys());
  useEffect(() => { document.documentElement.dataset.theme = t; }, [t]);
  return [t, () => { const n = t === 'dark' ? 'light' : 'dark'; setT(n); try { localStorage.setItem('theme', n); } catch { /* ignoreres */ } }];
}

export const fullName = (c: { first_name: string | null; middle_name?: string | null; last_name: string | null }) =>
  [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');
