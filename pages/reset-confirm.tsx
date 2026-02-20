import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../lib/supabaseClient';
import Link from 'next/link';

/**
 * Pagina di conferma reset password.
 *
 * Dopo aver cliccato il link nell'email di recupero, l'utente viene
 * automaticamente loggato. Questa pagina permette di impostare una nuova
 * password.
 */
export default function ResetConfirm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Quando la pagina viene caricata Supabase dovrebbe già avere creato
    // automaticamente una sessione. Se non c'è sessione inviamo al login.
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // Non c'è sessione valida. Porta l'utente al login.
        router.replace('/login');
      }
    }
    checkSession();
  }, [router]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }
    setStatus('saving');
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
      });
      if (error) {
        setStatus('error');
        setError(error.message);
      } else {
        setStatus('success');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Errore nel salvataggio.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 space-y-4">
      <h1 className="text-3xl font-bold">Reimposta la password</h1>
      {status === 'success' ? (
        <div className="bg-green-100 text-green-800 p-4 rounded shadow max-w-md text-center">
          <p>Password aggiornata correttamente. Ora puoi</p>
          <Link href="/login" className="text-blue-600 hover:underline">
            accedere con le nuove credenziali
          </Link>
          .
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          className="w-full max-w-sm bg-white p-6 rounded shadow-md space-y-4"
        >
          <label className="block">
            <span className="text-gray-700">Nuova password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </label>
          <label className="block">
            <span className="text-gray-700">Conferma nuova password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </label>
          {status === 'error' && error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Salvataggio…' : 'Aggiorna password'}
          </button>
        </form>
      )}
    </div>
  );
}