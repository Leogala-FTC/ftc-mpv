import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';

/**
 * Pagina di amministrazione utenti.
 *
 * Elenca gli utenti con ruolo e stato di onboarding. Permette di cambiare
 * ruolo tra 'user' e 'merchant' per scopi demo. L'admin non può essere
 * modificato qui.
 */
export default function AdminUsers() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      await fetchUsers();
    }
    load();
  }, [router]);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, onboarded, phone, city, province');
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message || 'Errore nel recuperare gli utenti');
    } finally {
      setLoading(false);
    }
  }

  // Toggle role between user and merchant
  async function toggleRole(id: string, currentRole: string) {
    setError(null);
    setMessage(null);
    const newRole = currentRole === 'user' ? 'merchant' : 'user';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', id);
      if (error) throw error;
      setMessage(`Ruolo aggiornato a ${newRole}`);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Errore nel cambiare ruolo');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Caricamento…</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen p-6 space-y-6">
      <h1 className="text-3xl font-bold">Gestione utenti</h1>
      <nav className="flex space-x-4 mb-4">
        <Link href="/admin" className="text-blue-600 hover:underline">Dashboard</Link>
        <Link href="/admin/clearing" className="text-blue-600 hover:underline">Clearing</Link>
        <Link href="/admin/topups" className="text-blue-600 hover:underline">Topup</Link>
        <Link href="/admin/merchants" className="text-blue-600 hover:underline">Merchant</Link>
        <Link href="/admin/settings" className="text-blue-600 hover:underline">Impostazioni</Link>
      </nav>
      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-green-600">{message}</p>}
      <table className="min-w-full text-left border">
        <thead>
          <tr className="border-b">
            <th className="p-2">Nome</th>
            <th className="p-2">Role</th>
            <th className="p-2">Onboarded</th>
            <th className="p-2">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="p-2">{u.name}</td>
              <td className="p-2 capitalize">{u.role}</td>
              <td className="p-2">{u.onboarded ? '✅' : '❌'}</td>
              <td className="p-2 space-x-2">
                {u.role !== 'admin' && (
                  <button
                    onClick={() => toggleRole(u.id, u.role)}
                    className="bg-blue-600 text-white py-1 px-3 rounded hover:bg-blue-700"
                  >
                    Cambia ruolo
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}