import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Dashboard per il merchant.
 *
 * Mostra il saldo disponibile e pendente e presenta i collegamenti per vendere,
 * visualizzare il wallet e gestire il clearing. Se l'utente non ha ruolo
 * merchant viene reindirizzato.
 */
export default function MerchantDashboard() {
  const router = useRouter();
  const [available, setAvailable] = useState<number>(0);
  const [pending, setPending] = useState<number>(0);
  const [merchantName, setMerchantName] = useState('');
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
      // trova merchant id tramite merchant_staff
      const { data: staffRows } = await supabase
        .from('merchant_staff')
        .select('merchant_id')
        .eq('user_id', user.id);
      const merchantId = staffRows && staffRows.length ? staffRows[0].merchant_id : null;
      if (!merchantId) {
        setLoading(false);
        return;
      }
      const { data: wallet } = await supabase
        .from('merchant_wallets')
        .select('available_tokens, pending_tokens')
        .eq('merchant_id', merchantId)
        .single();
      setAvailable(wallet?.available_tokens || 0);
      setPending(wallet?.pending_tokens || 0);
      const { data: merchant } = await supabase
        .from('merchants')
        .select('name')
        .eq('id', merchantId)
        .single();
      setMerchantName(merchant?.name || '');
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
      <h1 className="text-3xl font-bold">Dashboard Merchant</h1>
      <h2 className="text-xl">{merchantName}</h2>
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
      <nav className="flex flex-col space-y-2">
        <Link href="/merchant/sell" className="text-blue-600 hover:underline text-lg">
          Vendi (Genera QR)
        </Link>
        <Link href="/merchant/wallet" className="text-blue-600 hover:underline text-lg">
          Wallet e movimenti
        </Link>
        <Link href="/merchant/clearing" className="text-blue-600 hover:underline text-lg">
          Richiesta di clearing
        </Link>
        <Link href="/profile" className="text-blue-600 hover:underline text-lg">
          Profilo
        </Link>
      </nav>
    </div>
  );
}