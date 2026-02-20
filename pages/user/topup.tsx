import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

interface Pack {
  id: number;
  name: string;
  tokens: number;
  is_active: boolean;
}

/**
 * Pagina di ricarica per l'utente.
 *
 * Mostra i pacchetti disponibili e consente all'utente di richiedere una
 * ricarica. La ricarica viene inserita nella tabella `topup_requests` con
 * stato pending e sarà poi elaborata dall'admin.
 */
export default function UserTopup() {
  const router = useRouter();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
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
      const { data } = await supabase
        .from('topup_packs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPacks(data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleRequest(pack: Pack) {
    setStatus('idle');
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non loggato');
      const { error } = await supabase.from('topup_requests').insert({
        user_id: user.id,
        pack_id: pack.id,
        tokens: pack.tokens,
        status: 'pending',
      });
      if (error) throw error;
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Errore nella richiesta');
    }
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
      <h1 className="text-3xl font-bold">Ricarica token</h1>
      {status === 'sent' && (
        <div className="bg-green-100 text-green-800 p-4 rounded">
          Richiesta di ricarica inviata! Sarà elaborata dall'amministratore.
        </div>
      )}
      {status === 'error' && error && (
        <div className="bg-red-100 text-red-800 p-4 rounded">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {packs.map((pack) => (
          <div key={pack.id} className="bg-white shadow rounded p-4 flex flex-col items-center space-y-2">
            <h2 className="text-xl font-semibold">{pack.name}</h2>
            <p className="text-2xl font-mono">{pack.tokens.toFixed(0)} token</p>
            <button
              onClick={() => handleRequest(pack)}
              className="mt-2 bg-purple-600 text-white py-1 px-3 rounded hover:bg-purple-700"
            >
              Richiedi
            </button>
          </div>
        ))}
      </div>
      <Link href="/user" className="text-blue-600 hover:underline">
        Torna alla dashboard
      </Link>
    </div>
  );
}