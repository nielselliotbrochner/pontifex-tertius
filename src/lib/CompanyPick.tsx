import { supabase } from './supabase';
import { useAsync } from './useAsync';

export type CompanyOpt = { id: string; name: string };
export const useCompanyOpts = () => useAsync(async () => {
  const r = await supabase.from('company').select('id,name').eq('active', true).order('name').limit(10000);
  if (r.error) throw r.error;
  return r.data as CompanyOpt[];
}, [], 'companyopts');

// Søgbart valg: skriv navnet og vælg fra listen.
export function CompanyPick({ value, onChange, options, listId }: { value: string; onChange: (v: string) => void; options: CompanyOpt[]; listId: string }) {
  return (
    <>
      <input list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Skriv for at søge" />
      <datalist id={listId}>{options.map((o) => <option key={o.id} value={o.name} />)}</datalist>
    </>
  );
}
export const findCompany = (opts: CompanyOpt[], name: string) => opts.find((o) => o.name.toLowerCase() === name.trim().toLowerCase());
