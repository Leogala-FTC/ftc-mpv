import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../lib/supabaseClient';

export default function ResetConfirm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // When arriving from the recovery email, Supabase session is in the URL.
    // Ensure the session is picked up.
    (async () => {
      await supabase.auth.getSession();
      setReady(true);
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!password || password !== password2) {
      setError('Le password non coincidono.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      return;
    }

    setInfo('Password aggiornata. Ora puoi fare login.');
    setTimeout(() => router.replace('/login'), 800);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Imposta nuova password</h1>
      {!ready ? (
        <p>Caricamento…</p>
      ) : (
        <form onSubmit={handleSave} className="w-full max-w-sm bg-white p-6 rounded shadow space-y-4">
          <label className="block">
            <span className="text-gray-700">Nuova password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
            />
          </label>
          <label className="block">
            <span className="text-gray-700">Ripeti password</span>
            <input
              type="password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm"
            />
          </label>
          {info && <p className="text-green-700 text-sm">{info}</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
            Salva password
          </button>
        </form>
      )}
    </div>
  );
}
