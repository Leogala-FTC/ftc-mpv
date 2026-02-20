import { useState } from 'react';
import Link from 'next/link';
import supabase from '../lib/supabaseClient';

function siteUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl()}/reset-confirm`,
      });
      if (error) throw error;
      setInfo('Ok! Controlla la mail: troverai il link per impostare una nuova password.');
    } catch (err: any) {
      setError(err?.message || 'Errore.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Recupero password</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded shadow space-y-4">
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
        {info && <p className="text-green-700 text-sm">{info}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Invio…' : 'Invia link reset'}
        </button>
      </form>
      <div className="mt-6">
        <Link href="/login" className="text-blue-600 hover:underline">Torna al login</Link>
      </div>
    </div>
  );
}
