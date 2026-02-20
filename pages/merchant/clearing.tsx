import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';
import Link from 'next/link';

/**
 * Merchant clearing request page.
 *
 * Allows a merchant to request token clearing by specifying the amount of
 * tokens to convert. Shows a live € estimate using the configured rate.
 */
export default function MerchantClearing() {
  const [rate, setRate] = useState(0.02);
  const [available, setAvailable] = useState(0);
  const [requested, setRequested] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('Utente non connesso');
        // fetch rate from app_settings
        const { data: settings, error: settingsError } = await supabase
          .from('app_settings')
          .select('token_eur_rate_estimate')
          .eq('id', 1)
          .single();
        if (!settingsError && settings) setRate(settings.token_eur_rate_estimate);
        // fetch merchant id from staff table
        const { data: staffRows, error: staffError } = await supabase
          .from('merchant_staff')
          .select('merchant_id')
          .eq('user_id', user.id);
        if (staffError) throw staffError;
        if (!staffRows || staffRows.length === 0) throw new Error('Nessun merchant associato');
        const merchantId = staffRows[0].merchant_id;
        // fetch wallet to determine available tokens
        const { data: wallet, error: walletError } = await supabase
          .from('merchant_wallets')
          .select('available_tokens')
          .eq('merchant_id', merchantId)
          .single();
        if (walletError) throw walletError;
        setAvailable(wallet.available_tokens);
      } catch (err: any) {
        setError(err.message || 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const eurEstimate = requested * rate;

  function handleMax() {
    setRequested(available);
  }

  function startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (requested <= 0) throw new Error('Inserire una quantità valida');
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Utente non connesso');
      // get merchant id again
      const { data: staffRows } = await supabase
        .from('merchant_staff')
        .select('merchant_id')
        .eq('user_id', user.id);
      const merchantId = staffRows?.[0]?.merchant_id;
      if (!merchantId) throw new Error('Merchant non trovato');
      const weekStart = startOfWeek(new Date()).toISOString().substring(0, 10);
      const { error: insertError } = await supabase.from('clearing_requests').insert({
        merchant_id: merchantId,
        requested_tokens: requested,
        eur_estimate: eurEstimate,
        week_start: weekStart,
        requested_by: user.id,
      });
      if (insertError) throw insertError;
      setSuccess('Richiesta di clearing inviata con successo.');
      setRequested(0);
    } catch (err: any) {
      setError(err.message || 'Errore nell’invio della richiesta');
    }
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Richiesta Clearing</h1>
      {loading && <p>Caricamento…</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {success && <p className="text-green-600 mb-4">{success}</p>}
      {!loading && !error && (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-gray-700 mb-1">Token disponibili</label>
            <input
              type="text"
              readOnly
              value={available.toFixed(2)}
              className="w-full border rounded p-2 bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Token da convertire</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={requested}
              onChange={(e) => setRequested(parseFloat(e.target.value))}
              className="w-full border rounded p-2"
            />
            <button
              type="button"
              onClick={handleMax}
              className="mt-2 text-blue-600 hover:underline"
            >
              MAX
            </button>
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Stima euro</label>
            <input
              type="text"
              readOnly
              value={eurEstimate.toFixed(2)}
              className="w-full border rounded p-2 bg-gray-100"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Invia richiesta
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