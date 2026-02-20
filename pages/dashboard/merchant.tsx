import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import Link from 'next/link';

interface MerchantWallet {
  available_tokens: number;
  pending_tokens: number;
}

/**
 * Merchant dashboard
 *
 * Displays the merchant wallet balances. Additional features like QR
 * generation and payment requests will be implemented here.
 */
export default function MerchantDashboard() {
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
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
        // Find the merchant associated with this user via merchant_staff table
        const { data: staffRows, error: staffError } = await supabase
          .from('merchant_staff')
          .select('merchant_id')
          .eq('user_id', user.id);
        if (staffError) throw staffError;
        if (!staffRows || staffRows.length === 0) {
          setError('L’utente non risulta associato a un merchant.');
          setLoading(false);
          return;
        }
        const merchantId = staffRows[0].merchant_id;
        const { data, error: walletError } = await supabase
          .from('merchant_wallets')
          .select('available_tokens, pending_tokens')
          .eq('merchant_id', merchantId)
          .single();
        if (walletError) throw walletError;
        setWallet(data as MerchantWallet);
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
      <h1 className="text-2xl font-bold mb-4">Dashboard Merchant</h1>
      {loading && <p>Caricamento…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {wallet && (
        <div className="bg-white shadow rounded p-4 space-y-2">
          <div>
            <p className="text-lg">Token disponibili:</p>
            <p className="text-2xl font-mono">{wallet.available_tokens.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-lg">Token pendenti:</p>
            <p className="text-2xl font-mono">{wallet.pending_tokens.toFixed(2)}</p>
          </div>
        </div>
      )}
      <div className="mt-6 space-y-4">
        <Link href="/" className="text-blue-600 hover:underline">
          Torna alla home
        </Link>
        <p className="text-sm text-gray-600">Presto saranno disponibili funzionalità per QR, incassi e clearing.</p>
      </div>
    </div>
  );
}