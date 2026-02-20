import { useEffect } from 'react';
import { useRouter } from 'next/router';
import supabase from '../../lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Supabase JS reads tokens from the URL automatically (detectSessionInUrl: true)
    // We just wait a moment and then go to home.
    const t = setTimeout(async () => {
      await supabase.auth.getSession();
      router.replace('/');
    }, 300);

    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <p>Sto completando l’accesso…</p>
    </main>
  );
}
