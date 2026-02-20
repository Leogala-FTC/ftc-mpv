import { useState } from 'react';
import Link from 'next/link';
import supabase from '../lib/supabaseClient';

/**
 * Pagina per richiedere il reset della password.
 *
 * Invia un'email con il link di reset. La conferma sarà gestita dal link
 * automatico di Supabase.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleForgot(event: React.FormEvent) {
    event.preventDefault();
    setStatus('idle');
    setError(null);
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-confirm`,
      });
      if (error) {
        setStatus('error');
        setError(error.message);
      } else {
        setStatus('sent');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Errore nella richiesta di reset.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 space-y-4">
      <h1 className="text-3xl font-bold">Recupero password</h1>
      {status === 'sent' ? (
        <div className="bg-green-100 text-green-800 rounded p-4 shadow max-w-md text-center">
          <p>Se l'indirizzo è registrato, riceverai un'email con il link per reimpostare la password.</p>
        </div>
      ) : (
        <form
          onSubmit={handleForgot}
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
          {status === 'error' && error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Invia email di reset
          </button>
        </form>
      )}
      <div className="text-center mt-4">
        <Link href="/login" className="text-blue-600 hover:underline">
          Torna al login
        </Link>
      </div>
    </div>
  );
}