import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Dashboard principale per l'utente.
 *
 * Mostra il saldo token e fornisce collegamenti alle sezioni del wallet,
 * pagamento, ricarica e ricevute. Se l'utente ha ruolo diverso viene
 * reindirizzato.
 */
export default function UserDashboard() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      // fetch profile
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('role, name, onboarded')
        .eq('id', user.id)
        .single();
      if (profileRow?.role !== 'user') {
        // ruoli non autorizzati
        if (profileRow?.role === 'merchant') router.replace('/merchant');
        else if (profileRow?.role === 'admin') router.replace('/admin');
        return;
      }
      setName(profileRow.name);
      // fetch wallet
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance_tokens')
        .eq('user_id', user.id)
        .single();
      setBalance(wallet?.balance_tokens || 0);
      setLoading(false);
    }
    loadData();
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
      <h1 className="text-3xl font-bold">Benvenuto {name}</h1>
      <div className="bg-white shadow rounded p-4">
        <p className="text-xl">Saldo token: <span className="font-mono">{balance?.toFixed(2)}</span></p>
      </div>
      <nav className="flex flex-col space-y-2">
        <Link href="/user/wallet" className="text-blue-600 hover:underline text-lg">
          Wallet
        </Link>
        <Link href="/user/pay" className="text-blue-600 hover:underline text-lg">
          Paga con QR
        </Link>
        <Link href="/user/topup" className="text-blue-600 hover:underline text-lg">
          Ricarica token
        </Link>
        <Link href="/user/receipts" className="text-blue-600 hover:underline text-lg">
          Ricevute
        </Link>
        <Link href="/profile" className="text-blue-600 hover:underline text-lg">
          Profilo
        </Link>
      </nav>
    </div>
  );
}