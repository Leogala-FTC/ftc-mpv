import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import Link from 'next/link';

interface Counts {
  users: number;
  merchants: number;
  pendingClearing: number;
}

/**
 * Admin dashboard
 *
 * Shows basic metrics about the system: number of users, merchants and pending
 * clearing requests. More advanced management views will be added here.
 */
export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCounts() {
      try {
        // parallel queries for counts
        const [usersRes, merchantsRes, clearingRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('merchants').select('id', { count: 'exact', head: true }),
          supabase
            .from('clearing_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ]);
        const usersCount = usersRes.count ?? 0;
        const merchantsCount = merchantsRes.count ?? 0;
        const clearingCount = clearingRes.count ?? 0;
        setCounts({ users: usersCount, merchants: merchantsCount, pendingClearing: clearingCount });
      } catch (err: any) {
        setError(err.message || 'Errore nel recuperare i dati.');
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard Admin</h1>
      {loading && <p>Caricamento…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {counts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 shadow rounded">
            <p className="text-lg">Utenti</p>
            <p className="text-3xl font-mono">{counts.users}</p>
          </div>
          <div className="bg-white p-4 shadow rounded">
            <p className="text-lg">Merchant</p>
            <p className="text-3xl font-mono">{counts.merchants}</p>
          </div>
          <div className="bg-white p-4 shadow rounded">
            <p className="text-lg">Clearing pendenti</p>
            <p className="text-3xl font-mono">{counts.pendingClearing}</p>
          </div>
        </div>
      )}
      <div className="mt-6 space-y-4">
        <Link href="/" className="text-blue-600 hover:underline">
          Torna alla home
        </Link>
        <p className="text-sm text-gray-600">Qui in futuro potrai gestire merchant, utenti e approvare clearing.</p>
      </div>
    </div>
  );
}