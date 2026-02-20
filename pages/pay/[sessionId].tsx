import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import Link from 'next/link';

type Session = {
  id: string;
  merchant_id: string;
  amount_tokens: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expires_at: string;
};

export default function PaySessionPage() {
  const router = useRouter();
  const sessionId = router.query.sessionId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [merchantName, setMerchantName] = useState<string>('');
  const [paying, setPaying] = useState(false);
  const [paidOk, setPaidOk] = useState(false);

  const expired = useMemo(() => {
    if (!session) return false;
    return new Date(session.expires_at).getTime() <= Date.now();
  }, [session]);

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          // user must be logged in to pay
          router.replace(`/login`);
          return;
        }

        const { data: s, error: sErr } = await supabase
          .from('payment_sessions')
          .select('id, merchant_id, amount_tokens, status, expires_at')
          .eq('id', sessionId)
          .single();
        if (sErr) throw sErr;
        setSession(s as Session);

        const { data: m, error: mErr } = await supabase
          .from('merchants')
          .select('name')
          .eq('id', (s as any).merchant_id)
          .single();
        if (!mErr && m?.name) setMerchantName(m.name);
      } catch (err: any) {
        setError(err.message || 'Impossibile caricare la richiesta di pagamento.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId, router]);

  async function confirmPay() {
    if (!sessionId) return;
    setPaying(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('pay_session', { p_session_id: sessionId });
      if (rpcErr) throw rpcErr;
      setPaidOk(true);
      // refresh session
      const { data: s } = await supabase
        .from('payment_sessions')
        .select('id, merchant_id, amount_tokens, status, expires_at')
        .eq('id', sessionId)
        .single();
      if (s) setSession(s as Session);
    } catch (err: any) {
      setError(err.message || 'Pagamento non riuscito.');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white shadow rounded p-5 space-y-4">
        <h1 className="text-2xl font-bold">Conferma pagamento</h1>

        {loading && <p>Caricamento…</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && session && (
          <>
            <div>
              <p className="text-sm text-gray-600">Esercente</p>
              <p className="text-lg font-semibold">{merchantName || session.merchant_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Token</p>
              <p className="text-3xl font-mono">{Number(session.amount_tokens).toFixed(2)}</p>
            </div>

            {session.status === 'paid' && (
              <p className="text-green-700 font-semibold">✅ Pagamento completato.</p>
            )}
            {session.status !== 'paid' && expired && (
              <p className="text-red-700 font-semibold">⏱️ QR scaduto. Chiedi al merchant di rigenerarlo.</p>
            )}

            {session.status === 'pending' && !expired && (
              <button
                disabled={paying}
                onClick={confirmPay}
                className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-60"
              >
                {paying ? 'Sto pagando…' : 'Conferma e paga'}
              </button>
            )}

            {paidOk && (
              <Link href="/dashboard/user" className="text-blue-600 hover:underline">
                Vai al wallet
              </Link>
            )}
          </>
        )}
      </div>
      <div className="mt-6">
        <Link href="/" className="text-blue-600 hover:underline">
          Torna alla home
        </Link>
      </div>
    </div>
  );
}
