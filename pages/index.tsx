import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import supabase from '../lib/supabaseClient';

interface Profile {
  role: 'user' | 'merchant' | 'admin';
  name: string;
  onboarded?: boolean;
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      const { data } = await supabase
        .from('profiles')
        .select('role, name, onboarded')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data as Profile);

        // Auto-redirect: if profile not completed, go onboarding.
        if (!data.onboarded) {
          router.replace('/onboarding');
          return;
        }

        if (data.role === 'merchant') router.replace('/dashboard/merchant');
        else if (data.role === 'admin') router.replace('/dashboard/admin');
        else router.replace('/dashboard/user');
        return;
      }

      setLoading(false);
    })();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 space-y-4">
      <h1 className="text-4xl font-bold">FTC MVP</h1>

      {loading && <p>Caricamento…</p>}

      {!loading && !userId && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-gray-700">Scegli cosa vuoi fare:</p>
          <Link
            href="/login"
            className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700"
          >
            Accedi
          </Link>
          <Link
            href="/login?mode=register"
            className="bg-gray-900 text-white py-2 px-6 rounded hover:bg-black"
          >
            Registrati
          </Link>
        </div>
      )}

      {!loading && userId && profile && (
        <div className="text-center space-y-2">
          <p className="text-lg">Ciao {profile.name}!</p>
          <button onClick={handleLogout} className="text-red-600 hover:underline">
            Esci
          </button>
        </div>
      )}
    </main>
  );
}
