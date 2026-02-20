import { useEffect, useState } from 'react';
import Link from 'next/link';
import supabase from '../lib/supabaseClient';

interface Profile {
  role: 'user' | 'merchant' | 'admin';
  name: string;
}

export default function Home() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser({ id: user.id });
        // fetch profile
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('role, name')
          .eq('id', user.id)
          .single();
        if (profileRow) setProfile(profileRow as Profile);
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 space-y-4">
      <h1 className="text-4xl font-bold">FTC MVP</h1>
      {loading && <p>Caricamento…</p>}
      {!loading && !user && (
        <>
          <p className="text-lg">Benvenuto! Accedi per iniziare.</p>
          <Link
            href="/login"
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Accedi
          </Link>
        </>
      )}
      {!loading && user && profile && (
        <>
          <p className="text-lg">Ciao {profile.name}!</p>
          <p className="text-md text-gray-600">Ruolo: {profile.role}</p>
          <div className="flex flex-col items-center space-y-2 mt-4">
            {profile.role === 'user' && (
              <Link
                href="/dashboard/user"
                className="text-blue-600 hover:underline text-lg"
              >
                Vai alla dashboard utente
              </Link>
            )}
            {profile.role === 'merchant' && (
              <>
                <Link
                  href="/dashboard/merchant"
                  className="text-blue-600 hover:underline text-lg"
                >
                  Vai alla dashboard merchant
                </Link>
                <Link
                  href="/merchant/sell"
                  className="text-blue-600 hover:underline text-lg"
                >
                  Vendi (QR)
                </Link>
                <Link
                  href="/merchant/clearing"
                  className="text-blue-600 hover:underline text-lg"
                >
                  Richiedi clearing
                </Link>
              </>
            )}
            {profile.role === 'admin' && (
              <>
                <Link
                  href="/dashboard/admin"
                  className="text-blue-600 hover:underline text-lg"
                >
                  Vai alla dashboard admin
                </Link>
                <Link
                  href="/admin/clearing"
                  className="text-blue-600 hover:underline text-lg"
                >
                  Gestisci clearing
                </Link>
              </>
            )}
            <button
              onClick={handleLogout}
              className="mt-4 text-red-600 hover:underline"
            >
              Esci
            </button>
          </div>
        </>
      )}
    </main>
  );
}