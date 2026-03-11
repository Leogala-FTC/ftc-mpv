"use client";

import { useState, useEffect } from "react";
import { createTopupRequest, getUserTopupRequests } from "@/app/actions/topup";
import { TOPUP_PACKAGES } from "@/lib/stripe";
import { getSupabaseClient } from "@/lib/supabase-client";

// ⚠️ Sostituisci con i dati reali di FTC
const FTC_IBAN = "IT60 X054 2811 1010 0000 0123 456";
const FTC_INTESTATO = "Foligno Token Club SRL";
const FTC_CAUSALE_PREFIX = "RICARICA FTC";

type Request = {
  id: string;
  package_eur: number;
  tokens: number;
  status: string;
  created_at: string;
};

export default function TopupPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id.slice(0, 8).toUpperCase());

      const [{ data: wallet }, reqs] = await Promise.all([
        supabase.from("wallets").select("token_balance").eq("profile_user_id", auth.user.id).single(),
        getUserTopupRequests(),
      ]);
      setBalance(wallet?.token_balance ?? 0);
      setRequests(reqs as Request[]);
    }
    load();
  }, [submitted]);

  async function handleSubmit() {
    if (selected === null) return;
    setSubmitting(true);
    setError("");
    const res = await createTopupRequest(selected);
    if (res.success) {
      setSubmitted(true);
      setSelected(null);
    } else {
      setError(res.error ?? "Errore");
    }
    setSubmitting(false);
  }

  const pkg = selected !== null ? TOPUP_PACKAGES[selected] : null;
  const causale = pkg ? `${FTC_CAUSALE_PREFIX} ${pkg.eur}EUR ${userId}` : "";

  const statusLabel: Record<string, string> = {
    pending: "⏳ In attesa",
    approved: "✓ Approvata",
    rejected: "✕ Rifiutata",
  };
  const statusColor: Record<string, string> = {
    pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
    approved: "text-green-700 bg-green-50 border-green-200",
    rejected: "text-red-700 bg-red-50 border-red-200",
  };

  const hasPending = requests.some(r => r.status === "pending");

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Ricarica Token</h1>
      <p className="text-sm text-gray-500 mb-6">
        Acquista token FTC tramite bonifico bancario. I token vengono accreditati entro 24h dalla verifica del pagamento.
      </p>

      {/* Saldo attuale */}
      {balance !== null && (
        <div className="mb-6 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Saldo attuale</p>
            <p className="text-2xl font-bold text-indigo-700 mt-0.5">{balance.toLocaleString("it-IT")} token</p>
          </div>
          <p className="text-sm text-indigo-400">≈ €{(balance / 11.7).toFixed(2)}</p>
        </div>
      )}

      {/* Avviso richiesta pending */}
      {hasPending && !submitted && (
        <div className="mb-6 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
          <p className="text-sm font-medium text-yellow-800">⏳ Hai una richiesta in attesa di approvazione.</p>
          <p className="text-xs text-yellow-600 mt-1">Non puoi fare una nuova richiesta finché quella attuale non è elaborata.</p>
        </div>
      )}

      {/* Successo invio */}
      {submitted && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-5 py-4">
          <p className="text-sm font-semibold text-green-800 mb-3">✓ Richiesta inviata!</p>
          <p className="text-sm text-green-700 mb-3">
            Effettua il bonifico con i dati qui sotto. I token verranno accreditati entro 24h dalla ricezione del pagamento.
          </p>
          <div className="bg-white rounded-lg border border-green-200 p-3 space-y-2 text-sm font-mono">
            <div>
              <p className="text-xs text-gray-500 font-sans">IBAN</p>
              <p className="font-semibold text-gray-800 break-all">{FTC_IBAN}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-sans">Intestato a</p>
              <p className="text-gray-800">{FTC_INTESTATO}</p>
            </div>
            {pkg && (
              <div>
                <p className="text-xs text-gray-500 font-sans">Importo</p>
                <p className="font-bold text-gray-900">€{pkg.eur},00</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 font-sans">Causale (obbligatoria)</p>
              <p className="font-bold text-indigo-700 break-all">{causale}</p>
            </div>
          </div>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-4 w-full py-2 rounded-lg border border-green-300 text-sm text-green-700 hover:bg-green-100"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Pacchetti */}
      {!submitted && !hasPending && (
        <>
          <p className="text-sm font-semibold text-gray-700 mb-3">Scegli il pacchetto</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {TOPUP_PACKAGES.map((pkg, i) => (
              <button
                key={i}
                onClick={() => setSelected(i === selected ? null : i)}
                className={`relative flex flex-col items-center rounded-xl border-2 px-4 py-5 transition-all text-left
                  ${selected === i
                    ? "border-indigo-600 bg-indigo-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-indigo-300"
                  }`}
              >
                {i === 2 && (
                  <span className="absolute -top-2.5 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">
                    Più popolare
                  </span>
                )}
                <p className="text-2xl font-bold text-gray-900 self-start">€{pkg.eur}</p>
                <p className="text-sm font-semibold text-indigo-600 mt-1 self-start">
                  {pkg.tokens.toLocaleString("it-IT")} token
                </p>
                <p className="text-xs text-gray-400 mt-0.5 self-start">{pkg.label}</p>
                {selected === i && (
                  <span className="absolute top-3 right-3 text-indigo-600 text-base">✓</span>
                )}
              </button>
            ))}
          </div>

          {selected !== null && pkg && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-sm space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Riepilogo ordine</p>
              <div className="flex justify-between">
                <span className="text-gray-600">Pacchetto</span>
                <span className="font-medium">{pkg.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Token</span>
                <span className="font-semibold text-indigo-600">{pkg.tokens.toLocaleString("it-IT")} token</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-700 font-medium">Importo bonifico</span>
                <span className="font-bold text-gray-900">€{pkg.eur},00</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={selected === null || submitting}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Invio in corso..." : "Richiedi ricarica →"}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Dopo aver cliccato riceverai i dati per il bonifico
          </p>
        </>
      )}

      {/* Storico richieste */}
      {requests.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Le tue richieste</h2>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {r.tokens.toLocaleString()} token · €{r.package_eur}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(r.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium border ${statusColor[r.status] ?? "text-gray-600 bg-gray-50"}`}>
                  {statusLabel[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
