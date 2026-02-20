import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../lib/supabaseClient';

type RoleChoice = 'user' | 'merchant';

export default function Onboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleChoice>('user');
  const [merchantName, setMerchantName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, role, onboarded')
        .eq('id', user.id)
        .single();

      if (profile?.onboarded) {
        // already done
        if (profile.role === 'merchant') router.replace('/dashboard/merchant');
        else if (profile.role === 'admin') router.replace('/dashboard/admin');
        else router.replace('/dashboard/user');
        return;
      }

      if (profile?.name) setName(profile.name);
      setLoading(false);
    })();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Inserisci il tuo nome.');
      return;
    }

    if (role === 'merchant' && !merchantName.trim()) {
      setError('Inserisci il nome attività (merchant).');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('complete_onboarding', {
        p_role: role,
        p_name: name.trim(),
        p_merchant_name: role === 'merchant' ? merchantName.trim() : null,
      });
      if (error) throw error;

      router.replace(role === 'merchant' ? '/dashboard/merchant' : '/dashboard/user');
    } catch (err: any) {
      setError(err?.message || 'Errore.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p>Caricamento…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Completa profilo</h1>
      <p className="text-gray-600 mb-6">Solo la prima volta.</p>

      <form onSubmit={handleSave} className="w-full max-w-md bg-white p-6 rounded shadow space-y-4">
        <label className="block">
          <span className="text-gray-700">Nome e cognome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm"
            placeholder="Es. Leonardo Galà"
          />
        </label>

        <div className="space-y-2">
          <span className="text-gray-700">Sei un:</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={`px-4 py-2 rounded border ${role === 'user' ? 'bg-blue-600 text-white' : 'bg-white'}`}
            >
              Utente
            </button>
            <button
              type="button"
              onClick={() => setRole('merchant')}
              className={`px-4 py-2 rounded border ${role === 'merchant' ? 'bg-blue-600 text-white' : 'bg-white'}`}
            >
              Merchant
            </button>
          </div>
        </div>

        {role === 'merchant' && (
          <label className="block">
            <span className="text-gray-700">Nome attività (merchant)</span>
            <input
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
              placeholder="Es. Pizzeria da Mario"
            />
          </label>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Salvataggio…' : 'Continua'}
        </button>
      </form>
    </div>
  );
}
