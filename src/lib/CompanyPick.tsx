import { supabase } from './supabase';
import { useAsync } from './useAsync';
import { fetchAll } from './fetchAll';

export type CompanyOpt = { id: string; name: string; aliases?: string[] };
export const useCompanyOpts = () => useAsync(async () => {
  const [r, h] = await Promise.all([
    supabase.from('company').select('id,name').eq('active', true).order('name').limit(10000),
    fetchAll<{ company_id: string; name: string }>((f, t) => supabase.from('company_name_history').select('company_id,name').order('company_id').order('name').range(f, t)),
  ]);
  if (r.error) throw r.error;
  const al = new Map<string, string[]>();
  for (const x of h) (al.get(x.company_id) ?? al.set(x.company_id, []).get(x.company_id)!).push(x.name);
  return (r.data as CompanyOpt[]).map((c) => ({ ...c, aliases: al.get(c.id) }));
}, [], 'companyopts');

// Søgbart valg: skriv det nuværende eller et tidligere navn og vælg fra listen.
export function CompanyPick({ value, onChange, options, listId }: { value: string; onChange: (v: string) => void; options: CompanyOpt[]; listId: string }) {
  return (
    <>
      <input list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Skriv for at søge" />
      <datalist id={listId}>
        {options.map((o) => <option key={o.id} value={o.name} />)}
        {options.flatMap((o) => (o.aliases ?? []).map((a) => <option key={o.id + a} value={a} label={'nu ' + o.name} />))}
      </datalist>
    </>
  );
}
export const findCompany = (opts: CompanyOpt[], name: string) => {
  const n = name.trim().toLowerCase();
  return opts.find((o) => o.name.toLowerCase() === n) ?? opts.find((o) => o.aliases?.some((a) => a.toLowerCase() === n));
};
