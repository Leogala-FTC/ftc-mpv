import { useState } from 'react';
import supabase from '../lib/supabaseClient';
import Link from 'next/link';

/**
 * Login page allows a user to sign in via magic link.
 *
 * Users enter their email address and receive a one‑time code or link to
 * authenticate. No password is required. After submitting, a notice will
 * display prompting the user to check their inbox.
 */
export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setStatus('idle');
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        setStatus('error');
        setError(error.message);
      } else {
        setStatus('sent');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Errore nella richiesta.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Accedi a FTC</h1>
      {status === 'sent' ? (
        <div className="bg-green-100 text-green-800 rounded p-4 shadow">
          <p className="mb-2">
            Abbiamo inviato un link di accesso a <strong>{email}</strong>.
          </p>
          <p>Controlla la tua casella di posta per continuare.</p>
        </div>
      ) : (
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
              placeholder="tuo@email.it"
            />
          </label>
          {status === 'error' && error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Invia link di accesso
          </button>
        </form>
      )}
      <div className="mt-6">
        <Link href="/" className="text-blue-600 hover:underline">
          Torna alla home
        </Link>
      </div>
    </div>
  );
}