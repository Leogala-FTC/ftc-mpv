import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

interface Receipt {
  id: string;
  merchant_id: string;
  amount_tokens: number;
  amount_eur: number;
  created_at: string;
  merchant?: { name?: string };
}

/**
 * Pagina ricevute per l'utente: elenco delle ricevute dei pagamenti effettuati.
 */
export default function Receipts() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
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
      if (profileRow?.role !== 'user') {
        router.replace('/');
        return;
      }
      const { data } = await supabase
        .from('receipts')
        .select('id, merchant_id, amount_tokens, amount_eur, created_at, merchants (name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setReceipts(data || []);
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
      <h1 className="text-3xl font-bold">Ricevute</h1>
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Data</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Merchant</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Token</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {receipts.map((rc) => (
            <tr key={rc.id} className="bg-white hover:bg-gray-50">
              <td className="px-4 py-2 text-sm text-gray-800">
                {new Date(rc.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-sm text-gray-800">
                {rc.merchants?.name || rc.merchant_id}
              </td>
              <td className="px-4 py-2 text-sm text-gray-800">
                {rc.amount_tokens.toFixed(2)}
              </td>
            </tr>
          ))}
          {receipts.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-2 text-center text-sm text-gray-500">
                Nessuna ricevuta disponibile.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Link href="/user" className="text-blue-600 hover:underline">
        Torna alla dashboard
      </Link>
    </div>
  );
}