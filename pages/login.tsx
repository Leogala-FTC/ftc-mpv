import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import supabase from '../lib/supabaseClient';

type Mode = 'login' | 'register';

function siteUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export default function LoginPage() {
  const router = useRouter();
  const initialMode = useMemo<Mode>(() => {
    const q = (router.query.mode as string) || '';
    return q.toLowerCase() === 'register' ? 'register' : 'login';
  }, [router.query.mode]);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMode(initialMode), [initialMode]);

  async function routeAfterLogin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, onboarded')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.onboarded) {
      router.replace('/onboarding');
      return;
    }

    if (profile.role === 'merchant') router.replace('/dashboard/merchant');
    else if (profile.role === 'admin') router.replace('/dashboard/admin');
    else router.replace('/dashboard/user');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError('Inserisci email e password.');
      return;
    }

    if (mode === 'register' && password !== password2) {
      setError('Le due password non coincidono.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteUrl()}/auth/callback`,
          },
        });
        if (error) throw error;
        setInfo(
          'Registrazione inviata. Controlla la mail e clicca sul link di conferma (solo la prima volta).'
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await routeAfterLogin();
      }
    } catch (err: any) {
      setError(err?.message || 'Errore.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">FTC</h1>

      <div className="w-full max-w-sm bg-white rounded shadow">
        <div className="grid grid-cols-2">
          <button
            className={`py-3 text-center font-semibold ${
              mode === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
            onClick={() => setMode('login')}
            type="button"
          >
            Accedi
          </button>
          <button
            className={`py-3 text-center font-semibold ${
              mode === 'register' ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
            onClick={() => setMode('register')}
            type="button"
          >
            Registrati
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block">
            <span className="text-gray-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
              placeholder="tuo@email.it"
            />
          </label>

          <label className="block">
            <span className="text-gray-700">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
              placeholder="Password"
            />
          </label>

          {mode === 'register' && (
            <label className="block">
              <span className="text-gray-700">Ripeti password</span>
              <input
                type="password"
                required
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm"
                placeholder="Ripeti password"
              />
            </label>
          )}

          {info && <p className="text-green-700 text-sm">{info}</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {loading
              ? 'Attendi…'
              : mode === 'register'
              ? 'Crea account'
              : 'Accedi'}
          </button>

          {mode === 'login' && (
            <div className="text-center">
              <Link href="/reset-password" className="text-blue-600 hover:underline text-sm">
                Password dimenticata?
              </Link>
            </div>
          )}
        </form>
      </div>

      <div className="mt-6">
        <Link href="/" className="text-blue-600 hover:underline">
          Torna alla home
        </Link>
      </div>
    </div>
  );
}
