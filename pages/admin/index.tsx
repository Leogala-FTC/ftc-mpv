import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Dashboard principale per l'amministratore.
 *
 * Mostra alcune statistiche aggregati e collegamenti alle sezioni di gestione.
 */
export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
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
      if (profileRow?.role !== 'admin') {
        router.replace('/');
        return;
      }
      try {
        // Count users by role
        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'user');
        const { count: merchantCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'merchant');
        const { count: adminCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');
        // Sum token balances
        const { data: userWallets } = await supabase
          .from('user_wallets')
          .select('balance_tokens');
        const totalUserTokens = (userWallets || []).reduce(
          (acc, w) => acc + (w.balance_tokens || 0),
          0
        );
        const { data: merchantWallets } = await supabase
          .from('merchant_wallets')
          .select('available_tokens, pending_tokens');
        const totalMerchantTokens = (merchantWallets || []).reduce(
          (acc, w) => acc + (w.available_tokens || 0) + (w.pending_tokens || 0),
          0
        );
        const { data: treasury } = await supabase
          .from('treasury_wallet')
          .select('balance_tokens')
          .single();
        const totalTokens = totalUserTokens + totalMerchantTokens + (treasury?.balance_tokens || 0);
        // Count pending clearing requests
        const { count: pendingClearing } = await supabase
          .from('clearing_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        // Topups pending
        const { count: pendingTopups } = await supabase
          .from('topup_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setStats({
          userCount,
          merchantCount,
          adminCount,
          totalTokens,
          pendingClearing,
          pendingTopups,
        });
      } catch (err: any) {
        setError(err.message || 'Errore nel caricare le statistiche');
      } finally {
        setLoading(false);
      }
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
      <h1 className="text-3xl font-bold">Dashboard Admin</h1>
      {error && <p className="text-red-600">{error}</p>}
      {!error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white shadow rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Utenti</h2>
            <p>Utenti: {stats.userCount}</p>
            <p>Merchant: {stats.merchantCount}</p>
            <p>Admin: {stats.adminCount}</p>
          </div>
          <div className="bg-white shadow rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Token totali</h2>
            <p>{stats.totalTokens?.toFixed(2)} token</p>
          </div>
          <div className="bg-white shadow rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Clearing</h2>
            <p>Richieste pendenti: {stats.pendingClearing}</p>
          </div>
          <div className="bg-white shadow rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Ricariche</h2>
            <p>Richieste pendenti: {stats.pendingTopups}</p>
          </div>
        </div>
      )}
      <nav className="flex flex-col space-y-2">
        <Link href="/admin/clearing" className="text-blue-600 hover:underline text-lg">
          Gestisci clearing
        </Link>
        <Link href="/admin/topups" className="text-blue-600 hover:underline text-lg">
          Gestisci topup
        </Link>
        <Link href="/admin/users" className="text-blue-600 hover:underline text-lg">
          Gestisci utenti
        </Link>
        <Link href="/admin/merchants" className="text-blue-600 hover:underline text-lg">
          Gestisci merchant
        </Link>
        <Link href="/admin/settings" className="text-blue-600 hover:underline text-lg">
          Impostazioni
        </Link>
        <Link href="/profile" className="text-blue-600 hover:underline text-lg">
          Profilo
        </Link>
      </nav>
    </div>
  );
}