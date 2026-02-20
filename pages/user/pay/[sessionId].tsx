import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../../../lib/supabaseClient';
import Link from 'next/link';

interface SessionDetail {
  id: string;
  merchant_id: string;
  amount_eur: number;
  amount_tokens: number;
  status: string;
  expires_at: string;
  merchants?: { name?: string };
}

/**
 * Pagina di conferma pagamento.
 *
 * Mostra i dettagli della sessione e permette di confermare il pagamento.
 */
export default function PayConfirm() {
  const router = useRouter();
  const { sessionId } = router.query;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'pending' | 'success' | 'error' | 'expired'>(
    'pending'
  );
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    async function fetchData() {
      if (!sessionId || typeof sessionId !== 'string') return;
      const { data, error } = await supabase
        .from('payment_sessions')
        .select('id, merchant_id, amount_eur, amount_tokens, status, expires_at, merchants(name)')
        .eq('id', sessionId)
        .single();
      if (error || !data) {
        setError('Pagamento non trovato.');
        setLoading(false);
        return;
      }
      setSession(data as SessionDetail);
      setLoading(false);
    }
    fetchData();
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    // countdown aggiornato ogni secondo
    function updateRemaining() {
      const exp = new Date(session.expires_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((exp - now) / 1000));
      setRemaining(diff);
      if (diff <= 0) {
        setStatus('expired');
      }
    }
    updateRemaining();
    const id = setInterval(updateRemaining, 1000);
    return () => clearInterval(id);
  }, [session]);

  async function handlePay() {
    if (!session) return;
    setStatus('pending');
    setError(null);
    try {
      const { error } = await supabase.rpc('pay_session', { p_session_id: session.id });
      if (error) {
        if (error.message.includes('scaduto')) setStatus('expired');
        else setStatus('error');
        setError(error.message);
      } else {
        setStatus('success');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Errore nel pagamento.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Caricamento…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-red-100 text-red-800 p-4 rounded shadow max-w-md text-center">
          <p>{error}</p>
          <Link href="/user" className="text-blue-600 hover:underline mt-4 inline-block">
            Torna alla dashboard
          </Link>
        </div>
      </div>
    );
  }
  if (!session) return null;
  return (
    <div className="min-h-screen p-6 flex flex-col items-center space-y-6">
      <h1 className="text-3xl font-bold">Conferma pagamento</h1>
      <div className="bg-white shadow rounded p-6 w-full max-w-md space-y-2 text-center">
          <p className="text-lg">
            Esercente: <strong>{session.merchants?.name || session.merchant_id}</strong>
          </p>
          <p className="text-lg">
            Token da pagare: <strong>{session.amount_tokens.toFixed(2)}</strong>
          </p>
          <p className="text-sm text-gray-600">
            Scade fra {remaining} secondi
          </p>
          {status === 'success' && (
            <p className="text-green-600 font-semibold">Pagamento riuscito!</p>
          )}
          {status === 'error' && error && (
            <p className="text-red-600">{error}</p>
          )}
          {status === 'expired' && (
            <p className="text-red-600">Sessione scaduta.</p>
          )}
          {status === 'pending' && remaining > 0 && (
            <button
              onClick={handlePay}
              className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
            >
              Conferma pagamento
            </button>
          )}
      </div>
      <Link href="/user" className="text-blue-600 hover:underline">
        Torna alla dashboard
      </Link>
    </div>
  );
}