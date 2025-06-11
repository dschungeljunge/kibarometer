import { createClient } from '@supabase/supabase-js';

// Supabase Configuration aus Environment Variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validierung der Environment Variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase Environment Variables sind nicht konfiguriert. ' +
    'Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local setzen.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 