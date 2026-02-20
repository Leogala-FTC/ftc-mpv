import { useState } from 'react';
import Link from 'next/link';
import supabase from '../lib/supabaseClient';

/**
 * Pagina di accesso tramite email e password.
 *
 * Gli utenti registrati possono autenticarsi inserendo le proprie credenziali. In
 * caso di errore viene mostrato un messaggio appropriato. Presenta link per
 * registrarsi o recuperare la password.
 */
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setStatus('loading');
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setStatus('error');
        setError(error.message);
      } else {
        // Dopo login, redirect alla home. Next/router potrebbe essere usato,
        // ma window.location funziona in modo semplice.
        window.location.href = '/';
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Errore durante il login.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 space-y-4">
      <h1 className="text-3xl font-bold">Accedi</h1>
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white p-6 rounded shadow-md space-y-4"
      >
        <label className="block">
          <span className="text-gray-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </label>
        {status === 'error' && error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
      <div className="text-center space-y-2">
        <p>
          Non hai un account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Registrati qui
          </Link>
        </p>
        <p>
          <Link href="/forgot" className="text-blue-600 hover:underline">
            Password dimenticata?
          </Link>
        </p>
        <p>
          <Link href="/" className="text-blue-600 hover:underline">
            Torna alla home
          </Link>
        </p>
      </div>
    </div>
  );
}