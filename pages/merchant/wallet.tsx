import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

interface Transaction {
  id: string;
  type: 'spend' | 'topup';
  amount_tokens: number;
  created_at: string;
  user_id: string | null;
  metadata: any;
}

/**
 * Pagina wallet per il merchant: mostra il saldo disponibile, pendente e la lista
 * dei movimenti di incasso.
 */
export default function MerchantWallet() {
  const router = useRouter();
  const [available, setAvailable] = useState(0);
  const [pending, setPending] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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
      const merchantId = staffRows && staffRows.length ? staffRows[0].merchant_id : null;
      if (merchantId) {
        const { data: wallet } = await supabase
          .from('merchant_wallets')
          .select('*')
          .eq('merchant_id', merchantId)
          .single();
        setAvailable(wallet?.available_tokens || 0);
        setPending(wallet?.pending_tokens || 0);
        const { data: tx } = await supabase
          .from('token_transactions')
          .select('*')
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false });
        setTransactions(tx || []);
      }
      setLoading(false);
    }
    load();
  }, [router]);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Caricamento…</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallet merchant</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white shadow rounded p-4">
          <p className="text-lg">Token disponibili</p>
          <p className="text-3xl font-mono">{available.toFixed(2)}</p>
        </div>
        <div className="bg-white shadow rounded p-4">
          <p className="text-lg">Token in attesa</p>
          <p className="text-3xl font-mono">{pending.toFixed(2)}</p>
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-semibold mb-2">Movimenti</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Data</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tipo</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Token</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id} className="bg-white hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-800">
                  {new Date(tx.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-sm text-gray-800 capitalize">
                  {tx.type === 'spend' ? 'Incasso' : 'Ricarica'}
                </td>
                <td className="px-4 py-2 text-sm text-gray-800">
                  {tx.amount_tokens.toFixed(2)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-center text-sm text-gray-500">
                  Nessun movimento presente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Link href="/merchant" className="text-blue-600 hover:underline">
        Torna alla dashboard
      </Link>
    </div>
  );
}