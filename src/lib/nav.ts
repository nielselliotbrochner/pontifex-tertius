import { useEffect, useState } from 'react';

// Enkel routing via ?v=visning&id=... så siden virker på GitHub Pages uden serveropsætning.
export type Route = { view: string; id: string | null };

function read(): Route {
  const p = new URLSearchParams(window.location.search);
  return { view: p.get('v') ?? 'personer', id: p.get('id') };
}

export function href(view: string, id?: string): string {
  const p = new URLSearchParams();
  p.set('v', view);
  if (id) p.set('id', id);
  return window.location.pathname + '?' + p.toString();
}

export function go(view: string, id?: string) {
  window.history.pushState({}, '', href(view, id));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(read);
  useEffect(() => {
    const f = () => setR(read());
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);
  return r;
}

export function onLink(e: React.MouseEvent<HTMLAnchorElement>, view: string, id?: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  go(view, id);
}
