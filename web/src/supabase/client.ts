import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@shared/supabase/config';
import { initSupabase } from '@shared/supabase/clientRef';

// Override with env vars if available (Vercel production)
const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);

// Register client for shared queries
initSupabase(supabase);
