import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import supabase from '../../../lib/supabaseClient';

/**
 * Pagina di ingresso al pagamento: l'utente inserisce l'ID della sessione di
 * pagamento generata dal merchant (o scansiona un QR nel futuro). Dopo
 * l'inserimento viene reindirizzato alla pagina di conferma.
 */
export default function PayEntry() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // assicurati che l'utente sia loggato e sia user
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profileRow?.role !== 'user') {
        router.replace('/');
        return;
      }
      setLoading(false);
    }
    check();
  }, [router]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionId) return;
    router.push(`/user/pay/${sessionId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Caricamento…</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen p-6 space-y-6">
      <h1 className="text-3xl font-bold">Paga con QR / ID</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <label className="block">
          <span className="text-gray-700">ID pagamento / QR</span>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            required
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </label>
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Procedi al pagamento
        </button>
      </form>
      <Link href="/user" className="text-blue-600 hover:underline">
        Torna alla dashboard
      </Link>
    </div>
  );
}