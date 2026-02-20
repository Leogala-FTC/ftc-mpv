import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';

type PricingRow = { amount_eur: number; cost_tokens: number };
type SessionRow = {
  id: string;
  amount_tokens: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expires_at: string;
};

const AMOUNTS_EUR = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100];

export default function MerchantSell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<Map<number, number>>(new Map());
  const [ttlSeconds, setTtlSeconds] = useState<number>(90);

  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const payUrl = useMemo(() => {
    if (!activeSession) return null;
    if (typeof window === 'undefined') return null;
    return `${window.location.origin}/pay/${activeSession.id}`;
  }, [activeSession]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Non sei loggato. Vai su /login.');

        const { data: settings } = await supabase
          .from('app_settings')
          .select('session_ttl_seconds')
          .eq('id', 1)
          .single();
        if (settings?.session_ttl_seconds) setTtlSeconds(settings.session_ttl_seconds);

        const { data: staffRows, error: staffError } = await supabase
          .from('merchant_staff')
          .select('merchant_id')
          .eq('user_id', user.id);
        if (staffError) throw staffError;
        const mId = staffRows?.[0]?.merchant_id;
        if (!mId) throw new Error('Questo utente non è collegato a nessun merchant.');
        setMerchantId(mId);

        const { data: pricingRows, error: pricingError } = await supabase
          .from('merchant_pricing')
          .select('amount_eur, cost_tokens')
          .eq('merchant_id', mId);
        if (pricingError) throw pricingError;
        const map = new Map<number, number>();
        (pricingRows as PricingRow[] | null)?.forEach((r) => map.set(Number(r.amount_eur), Number(r.cost_tokens)));
        setPricing(map);
      } catch (err: any) {
        setError(err.message || 'Errore di caricamento.');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    // cleanup realtime channel
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  function subscribeToSession(sessionId: string) {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel(`payment_session_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payment_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as any;
          setActiveSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: row.status,
            };
          });
        }
      )
      .subscribe();
    channelRef.current = ch;
  }

  function secondsLeft(): number {
    if (!activeSession) return 0;
    const exp = new Date(activeSession.expires_at).getTime();
    return Math.max(0, Math.ceil((exp - nowMs) / 1000));
  }

  async function createSession(amountEur: number) {
    setError(null);
    try {
      if (!merchantId) throw new Error('Merchant non trovato.');
      const tokens = pricing.get(amountEur);
      if (!tokens) {
        throw new Error('Manca la tabella prezzi (merchant_pricing) per questo importo.');
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Non sei loggato.');

      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      const { data, error: insErr } = await supabase
        .from('payment_sessions')
        .insert({
          merchant_id: merchantId,
          amount_eur: amountEur,
          amount_tokens: tokens,
          status: 'pending',
          expires_at: expiresAt,
          created_by: user.id,
        })
        .select('id, amount_tokens, status, expires_at')
        .single();
      if (insErr) throw insErr;
      setActiveSession(data as SessionRow);
      subscribeToSession((data as any).id);
    } catch (err: any) {
      setError(err.message || 'Errore creazione sessione.');
    }
  }

  async function cancelSession() {
    if (!activeSession) return;
    try {
      await supabase.from('payment_sessions').update({ status: 'cancelled' }).eq('id', activeSession.id);
      setActiveSession(null);
    } catch {
      setActiveSession(null);
    }
  }

  const left = secondsLeft();
  const expired = activeSession ? left <= 0 && activeSession.status === 'pending' : false;

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Vendi (Merchant)</h1>

      {loading && <p>Caricamento…</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {!loading && !activeSession && (
        <div className="space-y-3">
          <p className="text-gray-700">Seleziona un importo. Verrà generato un QR valido {ttlSeconds}s.</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-w-3xl">
            {AMOUNTS_EUR.map((eur) => (
              <button
                key={eur}
                onClick={() => createSession(eur)}
                className="bg-blue-600 text-white py-3 rounded hover:bg-blue-700"
              >
                € {eur}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Nota: il cliente vedrà solo i token (non l’equivalenza in euro).
          </p>
        </div>
      )}

      {!loading && activeSession && (
        <div className="bg-white shadow rounded p-4 max-w-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sessione</p>
              <p className="font-mono text-sm break-all">{activeSession.id}</p>
            </div>
            <button onClick={cancelSession} className="text-red-600 hover:underline">
              Annulla
            </button>
          </div>

          <div>
            <p className="text-gray-700">Token da pagare</p>
            <p className="text-3xl font-mono">{Number(activeSession.amount_tokens).toFixed(2)}</p>
          </div>

          {payUrl && (
            <div className="flex flex-col items-center space-y-2">
              <QRCodeSVG value={payUrl} size={220} />
              <a className="text-blue-600 underline text-sm" href={payUrl}>
                Apri link pagamento
              </a>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Tempo rimasto</p>
            <p className="font-mono">{left}s</p>
          </div>

          {activeSession.status === 'paid' && (
            <p className="text-green-700 font-semibold">✅ Pagato!</p>
          )}
          {expired && (
            <p className="text-red-700 font-semibold">⏱️ Scaduto. Crea un nuovo QR.</p>
          )}

          <button
            onClick={() => setActiveSession(null)}
            className="w-full bg-gray-900 text-white py-2 rounded"
          >
            Nuova vendita
          </button>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <Link href="/dashboard/merchant" className="text-blue-600 hover:underline">
          Torna alla dashboard merchant
        </Link>
        <div>
          <Link href="/" className="text-blue-600 hover:underline">
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}
