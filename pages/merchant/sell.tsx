import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../../lib/supabaseClient';
import Link from 'next/link';

interface Price {
  amount_eur: number;
  cost_tokens: number;
}

interface SessionRecord {
  id: string;
  amount_tokens: number;
  status: string;
  expires_at: string;
}

/**
 * Pagina di vendita per il merchant. Mostra 15 bottoni con importi in euro
 * basati sulla tabella `merchant_pricing`, crea la sessione di pagamento e
 * mostra l'ID generato.
 */
export default function Sell() {
  const router = useRouter();
  const [prices, setPrices] = useState<Price[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [loading, setLoading] = useState(true);
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
      if (profileRow?.role !== 'merchant') {
        router.replace('/');
        return;
      }
      const { data: staffRows } = await supabase
        .from('merchant_staff')
        .select('merchant_id')
        .eq('user_id', user.id);
      const mId = staffRows && staffRows.length ? staffRows[0].merchant_id : null;
      setMerchantId(mId);
      if (mId) {
        const { data: priceRows } = await supabase
          .from('merchant_pricing')
          .select('*')
          .eq('merchant_id', mId)
          .order('amount_eur', { ascending: true });
        setPrices(priceRows || []);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function createSession(price: Price) {
    setError(null);
    setSession(null);
    if (!merchantId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();
      const { data, error } = await supabase
        .from('payment_sessions')
        .insert({
          merchant_id: merchantId,
          amount_eur: price.amount_eur,
          amount_tokens: price.cost_tokens,
          status: 'pending',
          expires_at: expiresAt,
          created_by: user.id,
        })
        .select();
      if (error) throw error;
      if (data && data.length) {
        setSession(data[0] as any);
      }
    } catch (err: any) {
      setError(err.message || 'Errore nella creazione della sessione');
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
      <h1 className="text-3xl font-bold">Cassa</h1>
      <p>Scegli l'importo da incassare:</p>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
        {prices.map((p) => (
          <button
            key={p.amount_eur}
            onClick={() => createSession(p)}
            className="bg-blue-600 text-white py-4 px-2 rounded hover:bg-blue-700 text-center"
          >
            €{p.amount_eur.toFixed(2)}
          </button>
        ))}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {session && (
        <div className="bg-gray-100 p-4 rounded shadow mt-4">
          <p className="font-semibold mb-2">Pagamento creato!</p>
          <p>
            ID pagamento: <span className="font-mono">{session.id}</span>
          </p>
          <p>
            Token: {session.amount_tokens.toFixed(2)}
          </p>
          <p className="text-sm text-gray-600">
            Scade alle {new Date(session.expires_at).toLocaleTimeString()}
          </p>
          <p className="mt-2">
            Invia questo ID all'utente per il pagamento, oppure copia il link:
            <br />
            <span className="font-mono text-blue-600">
              {`${window.location.origin}/user/pay/${session.id}`}
            </span>
          </p>
        </div>
      )}
      <Link href="/merchant" className="text-blue-600 hover:underline">
        Torna alla dashboard
      </Link>
    </div>
  );
}