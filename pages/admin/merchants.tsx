import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';

/**
 * Pagina di gestione merchant per admin.
 *
 * Mostra la lista degli esercenti con i principali dati anagrafici aziendali.
 * Permette di vedere i dettagli ma non di modificare per questo MVP.
 */
export default function AdminMerchants() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<any[]>([]);
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
      await fetchMerchants();
    }
    load();
  }, [router]);

  async function fetchMerchants() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select(
          'id, name, legal_name, vat_number, tax_code, ateco_code, pec, sdi_code, address, cap, city, province, phone, website, sector, subsector'
        );
      if (error) throw error;
      setMerchants(data || []);
    } catch (err: any) {
      setError(err.message || 'Errore nel recuperare i merchant');
    } finally {
      setLoading(false);
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
      <h1 className="text-3xl font-bold">Gestione merchant</h1>
      <nav className="flex space-x-4 mb-4">
        <Link href="/admin" className="text-blue-600 hover:underline">Dashboard</Link>
        <Link href="/admin/clearing" className="text-blue-600 hover:underline">Clearing</Link>
        <Link href="/admin/topups" className="text-blue-600 hover:underline">Topup</Link>
        <Link href="/admin/users" className="text-blue-600 hover:underline">Utenti</Link>
        <Link href="/admin/settings" className="text-blue-600 hover:underline">Impostazioni</Link>
      </nav>
      {error && <p className="text-red-600">{error}</p>}
      <table className="min-w-full text-left border">
        <thead>
          <tr className="border-b">
            <th className="p-2">Nome</th>
            <th className="p-2">Ragione Sociale</th>
            <th className="p-2">P.IVA</th>
            <th className="p-2">Città</th>
            <th className="p-2">Settore</th>
          </tr>
        </thead>
        <tbody>
          {merchants.map((m) => (
            <tr key={m.id} className="border-b">
              <td className="p-2">{m.name}</td>
              <td className="p-2">{m.legal_name || '-'}</td>
              <td className="p-2">{m.vat_number || '-'}</td>
              <td className="p-2">{m.city || '-'}</td>
              <td className="p-2">{m.sector || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}