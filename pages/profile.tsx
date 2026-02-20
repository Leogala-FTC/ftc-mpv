import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';
import { useRouter } from 'next/router';

/**
 * Pagina profilo utente.
 *
 * Mostra le informazioni del profilo e permette di modificare il nome e alcuni
 * campi di contatto. Consente inoltre di eseguire il logout.
 */
export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: profileRow, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setProfile(profileRow);
      setName(profileRow.name || '');
      setPhone(profileRow.phone || '');
      setCity(profileRow.city || '');
      setProvince(profileRow.province || '');
      setLoading(false);
    }
    fetchProfile();
  }, [router]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non trovato.');
      const { error } = await supabase
        .from('profiles')
        .update({ name, phone, city, province })
        .eq('id', user.id);
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Caricamento…</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Profilo</h1>
      {profile && (
        <div className="mb-6">
          <p><strong>Email:</strong> {profile.email || ''}</p>
          <p><strong>Ruolo:</strong> {profile.role}</p>
        </div>
      )}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Telefono</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Città</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Provincia</label>
            <input
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          disabled={saving}
        >
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </form>
      <button
        onClick={handleLogout}
        className="mt-8 text-red-600 hover:underline"
      >
        Logout
      </button>
    </div>
  );
}