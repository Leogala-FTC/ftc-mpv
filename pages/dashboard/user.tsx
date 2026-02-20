import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import Link from 'next/link';

interface Wallet {
  balance_tokens: number;
}

/**
 * User dashboard
 *
 * Shows the current token balance and provides links to upcoming features
 * such as QR payments and top‑up packs.
 */
export default function UserDashboard() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWallet() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          setError('Nessun utente connesso.');
          setLoading(false);
          return;
        }
        const { data, error: walletError } = await supabase
          .from('user_wallets')
          .select('balance_tokens')
          .eq('user_id', user.id)
          .single();
        if (walletError) throw walletError;
        setWallet(data as Wallet);
      } catch (err: any) {
        setError(err.message || 'Errore nel recuperare il wallet.');
      } finally {
        setLoading(false);
      }
    }
    fetchWallet();
  }, []);

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard Utente</h1>
      {loading && <p>Caricamento…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {wallet && (
        <div className="bg-white shadow rounded p-4">
          <p className="text-xl">Saldo token:</p>
          <p className="text-3xl font-mono">{wallet.balance_tokens.toFixed(2)}</p>
        </div>
      )}
      <div className="mt-6 space-y-4">
        <Link href="/" className="text-blue-600 hover:underline">
          Torna alla home
        </Link>
        <p className="text-sm text-gray-600">Altre funzionalità presto disponibili: pagamento via QR, top‑up.</p>
      </div>
    </div>
  );
}