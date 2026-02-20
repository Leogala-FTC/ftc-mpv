import { useState, useEffect } from 'react';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';

/**
 * Pagina impostazioni per l'amministratore.
 *
 * Permette di visualizzare e aggiornare i parametri globali dell'app come il
 * tasso di conversione token/euro e la durata della sessione pagamento.
 */
export default function AdminSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState('0.02');
  const [ttl, setTtl] = useState('90');
  const [message, setMessage] = useState<string | null>(null);
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
      if (profileRow?.role !== 'admin') {
        router.replace('/');
        return;
      }
      await fetchSettings();
    }
    load();
  }, [router]);

  async function fetchSettings() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('token_eur_rate_estimate, session_ttl_seconds')
        .eq('id', 1)
        .single();
      if (error) throw error;
      setRate((data?.token_eur_rate_estimate || 0.02).toString());
      setTtl((data?.session_ttl_seconds || 90).toString());
    } catch (err: any) {
      setError(err.message || 'Errore nel recuperare le impostazioni');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const rateValue = parseFloat(rate);
      const ttlValue = parseInt(ttl, 10);
      const { error } = await supabase
        .from('app_settings')
        .update({ token_eur_rate_estimate: rateValue, session_ttl_seconds: ttlValue })
        .eq('id', 1);
      if (error) throw error;
      setMessage('Impostazioni aggiornate con successo');
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio');
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
      <h1 className="text-3xl font-bold">Impostazioni</h1>
      <nav className="flex space-x-4 mb-4">
        <Link href="/admin" className="text-blue-600 hover:underline">Dashboard</Link>
        <Link href="/admin/clearing" className="text-blue-600 hover:underline">Clearing</Link>
        <Link href="/admin/topups" className="text-blue-600 hover:underline">Topup</Link>
        <Link href="/admin/users" className="text-blue-600 hover:underline">Utenti</Link>
        <Link href="/admin/merchants" className="text-blue-600 hover:underline">Merchant</Link>
      </nav>
      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-green-600">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700">Tasso token/euro</label>
          <input
            type="number"
            step="0.0001"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">TTL sessione (secondi)</label>
          <input
            type="number"
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <button
          type="submit"
          className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
        >
          Salva
        </button>
      </form>
    </div>
  );
}