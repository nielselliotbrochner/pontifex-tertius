import { supabase } from './supabase';
import { useAsync } from './useAsync';
import { fullName } from './ui';

export type PickPerson = { id: string; name: string; company_id: string | null; company_name: string | null; own: boolean; label: string };

export const usePeople = () => useAsync(async () => {
  const [r, own] = await Promise.all([
    supabase.from('v_contact_overview').select('contact_id,first_name,middle_name,last_name,company_id,company_name').eq('active', true).order('last_name').limit(10000),
    supabase.from('company').select('id').eq('is_own', true),
  ]);
  if (r.error) throw r.error;
  const ownIds = new Set((own.data ?? []).map((x: { id: string }) => x.id));
  return (r.data as { contact_id: string; first_name: string; middle_name: string | null; last_name: string | null; company_id: string | null; company_name: string | null }[]).map((p): PickPerson => {
    const name = fullName(p);
    return { id: p.contact_id, name, company_id: p.company_id, company_name: p.company_name, own: !!p.company_id && ownIds.has(p.company_id), label: p.company_name ? `${name} · ${p.company_name}` : name };
  });
}, [], 'people');
