import { supabase } from './supabase';
import { useAsync } from './useAsync';

export type Opt = { id: string; name: string; sort_order: number; is_ranked?: boolean };
export type Lookups = { level: Opt[]; affiliation_type: Opt[]; company_type: Opt[]; sector: Opt[]; acquaintance: Opt[] };

async function load(): Promise<Lookups> {
  const names = ['level', 'affiliation_type', 'company_type', 'sector', 'acquaintance'] as const;
  const res = await Promise.all(names.map((n) => supabase.from(n).select('*').eq('active', true).order('sort_order')));
  const out: Record<string, Opt[]> = {};
  names.forEach((n, i) => { if (res[i].error) throw res[i].error; out[n] = (res[i].data ?? []) as Opt[]; });
  return out as unknown as Lookups;
}
export const useLookups = () => useAsync(load, [], 'lookups');
