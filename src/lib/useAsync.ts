import { useEffect, useState } from 'react';

const cache = new Map<string, unknown>();

// key: valgfri cache-nøgle. Med nøgle vises sidst kendte data med det samme, mens friske data hentes i baggrunden.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], key?: string): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(() => (key && cache.has(key) ? (cache.get(key) as T) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!(key && cache.has(key)));
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    if (key && cache.has(key)) { setData(cache.get(key) as T); setLoading(false); } else { setLoading(true); }
    fn().then(
      (d) => { if (key) cache.set(key, d); if (alive) { setData(d); setError(null); setLoading(false); } },
      (e: unknown) => { if (alive) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); } },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, loading, reload: () => setN((x) => x + 1) };
}
