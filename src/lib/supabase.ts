import { createClient } from '@supabase/supabase-js';

// Publishable key er beregnet til klienten. Adgang styres af RLS i databasen.
export const supabase = createClient('https://sqrtvqvyhhjlxbwtotjy.supabase.co', 'sb_publishable_rTGg8pB8Kha_rhgmj6_rjg_HkXZ5SlC');
