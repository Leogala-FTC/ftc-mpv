import { createClient } from '@supabase/supabase-js';

/*
 * Initialize a Supabase client instance.
 *
 * The URL and anon key are provided via environment variables. These
 * variables must be defined in the Vercel environment. See `.env.example`
 * for the expected names.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Throw an error early if env vars are missing. This helps catch
// misconfiguration during build and development.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Please update your environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;