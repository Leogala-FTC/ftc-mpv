import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

interface Transaction {
  id: string;
  type: 'spend' | 'topup';
  amount_tokens: number;
  created_at: string;
  merchant_id: string | null;
  metadata: any;
}

/**
 * Pagina wallet utente: mostra il saldo e la lista dei movimenti.
 */
export default function UserWallet() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      // fetch profile to ensure correct role
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profileRow?.role !== 'user') {
        router.replace('/');
        return;
      }
      // fetch wallet
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance_tokens')
        .eq('user_id', user.id)
        .single();
      setBalance(wallet?.balance_tokens || 0);
      // fetch transactions
      const { data: tx } = await supabase
        .from('token_transactions')
        .select('*')
        .or(`user_id.eq.${user.id},merchant_id.is.null`)
        .order('created_at', { ascending: false });
      setTransactions(tx || []);
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
      <h1 className="text-3xl font-bold">Wallet</h1>
      <div className="bg-white shadow rounded p-4">
        <p className="text-xl">Saldo token: <span className="font-mono">{balance.toFixed(2)}</span></p>
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
                  {tx.type === 'spend' ? 'Spesa' : 'Ricarica'}
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
      <Link href="/user" className="text-blue-600 hover:underline">
        Torna alla dashboard
      </Link>
    </div>
  );
}