import { useState } from 'react';
import Link from 'next/link';
import supabase from '../lib/supabaseClient';

/**
 * Pagina di registrazione.
 *
 * Permette la creazione di un account via email e password. Se la registrazione
 * richiede la conferma via email, verrà mostrato un messaggio di avviso.
 */
export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setStatus('error');
        setError(error.message);
      } else {
        // Registrazione riuscita. Se la conferma email è attiva la sessione
        // non verrà creata finché l'utente non clicca il link.
        setStatus('success');
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Errore nella registrazione.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 space-y-4">
      <h1 className="text-3xl font-bold">Crea un nuovo account</h1>
      {status === 'success' ? (
        <div className="bg-green-100 text-green-800 rounded p-4 shadow max-w-md">
          <p className="mb-2">
            Registrazione completata! Se la conferma email è richiesta riceverai un link nella tua casella di posta.
          </p>
          <p>
            Torna alla <Link href="/login" className="text-blue-600 hover:underline">pagina di accesso</Link> per entrare.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleRegister}
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
          <label className="block">
            <span className="text-gray-700">Conferma password</span>
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
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition"
          >
            Registrati
          </button>
        </form>
      )}
      <div className="mt-4">
        Hai già un account?{' '}
        <Link href="/login" className="text-blue-600 hover:underline">
          Accedi qui
        </Link>
      </div>
    </div>
  );
}