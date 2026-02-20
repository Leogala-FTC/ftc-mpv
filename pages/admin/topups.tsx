import { useState, useEffect } from 'react';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';

/**
 * Pagina di gestione topup per l'amministratore.
 *
 * Consente di:
 *  1) Visualizzare le richieste di ricarica pendenti e completarli manualmente.
 *  2) Effettuare una ricarica manuale a un utente inserendo la sua email e il numero di token.
 */
export default function AdminTopups() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [tokens, setTokens] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verifica ruolo admin e carica richieste pendenti
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
      await fetchPending();
    }
    load();
  }, [router]);

  async function fetchPending() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('topup_requests')
        .select('id, user_id, tokens, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      // join with profiles to get name (optional)
      // For each request, fetch user profile
      const enriched = await Promise.all(
        (data || []).map(async (req) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', req.user_id)
            .single();
          return { ...req, userName: profile?.name || '' };
        }),
      );
      setPending(enriched);
    } catch (err: any) {
      setError(err.message || 'Errore nel recupero delle richieste');
    } finally {
      setLoading(false);
    }
  }

  // Completa una richiesta pendente
  async function completeRequest(reqId: string, userId: string, tokenAmount: number) {
    setError(null);
    setMessage(null);
    try {
      // Accreditare token all'utente e contrassegnare richiesta completata
      // 1) Call admin_topup_user
      const { error: rpcError } = await supabase.rpc('admin_topup_user', {
        p_user_id: userId,
        p_tokens: tokenAmount,
      });
      if (rpcError) throw rpcError;
      // 2) Aggiorna status richiesta
      const { error: updateError } = await supabase
        .from('topup_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', reqId);
      if (updateError) throw updateError;
      setMessage('Richiesta completata.');
      await fetchPending();
    } catch (err: any) {
      setError(err.message || 'Errore durante il completamento');
    }
  }

  // Esegue topup manuale con email
  async function handleManualTopup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const amount = parseFloat(tokens);
    if (!email || !amount || amount <= 0) {
      setError('Inserisci email e un numero di token valido.');
      return;
    }
    try {
      const { error: rpcError } = await supabase.rpc('admin_topup_by_email', {
        p_email: email,
        p_tokens: amount,
      });
      if (rpcError) throw rpcError;
      setMessage(`Accreditati ${amount} token a ${email}.`);
      setEmail('');
      setTokens('');
      await fetchPending();
    } catch (err: any) {
      setError(err.message || 'Errore durante la ricarica');
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
      <h1 className="text-3xl font-bold">Gestione Topup</h1>
      <nav className="flex space-x-4 mb-4">
        <Link href="/admin" className="text-blue-600 hover:underline">Dashboard</Link>
        <Link href="/admin/clearing" className="text-blue-600 hover:underline">Clearing</Link>
        <Link href="/admin/users" className="text-blue-600 hover:underline">Utenti</Link>
        <Link href="/admin/merchants" className="text-blue-600 hover:underline">Merchant</Link>
        <Link href="/admin/settings" className="text-blue-600 hover:underline">Impostazioni</Link>
      </nav>
      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-green-600">{message}</p>}
      <section>
        <h2 className="text-xl font-semibold mb-2">Ricariche pendenti</h2>
        {pending.length === 0 ? (
          <p>Non ci sono richieste in attesa.</p>
        ) : (
          <table className="min-w-full text-left border">
            <thead>
              <tr className="border-b">
                <th className="p-2">Utente</th>
                <th className="p-2">Token</th>
                <th className="p-2">Data</th>
                <th className="p-2">Azione</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((req) => (
                <tr key={req.id} className="border-b">
                  <td className="p-2">{req.userName}</td>
                  <td className="p-2">{req.tokens.toFixed(2)}</td>
                  <td className="p-2">{new Date(req.created_at).toLocaleString()}</td>
                  <td className="p-2">
                    <button
                      onClick={() => completeRequest(req.id, req.user_id, req.tokens)}
                      className="bg-green-600 text-white py-1 px-3 rounded hover:bg-green-700"
                    >
                      Completa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Ricarica manuale</h2>
        <form onSubmit={handleManualTopup} className="space-y-2 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email utente</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Token da accreditare</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Esegui topup
          </button>
        </form>
      </section>
    </div>
  );
}