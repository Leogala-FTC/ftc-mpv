"use client";

import { useState } from "react";
import { TOPUP_PACKAGES } from "@/lib/stripe";
import { createTopupRequest } from "@/app/actions/topup";

const FTC_IBAN = "IT60 X054 2811 1010 0000 0123 456";
const FTC_INTESTATO = "Foligno Token Club SRL";

type PayMethod = "bank" | "card";

export default function TopupPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [method, setMethod] = useState<PayMethod>("bank");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const pkg = selected !== null ? TOPUP_PACKAGES[selected] : null;

  async function handleBankSubmit() {
    if (selected === null || !pkg) return;
    setLoading(true);
    setError("");
    const res = await createTopupRequest(selected);
    if (res.success) {
      setDone(true);
    } else {
      setError(res.error ?? "Errore invio richiesta");
    }
    setLoading(false);
  }

  async function handleCardSubmit() {
    if (!pkg) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/create-topup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageEur: pkg.eur }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Pagamento carta non disponibile al momento.");
      }
    } catch {
      setError("Servizio carta temporaneamente non disponibile.");
    }
    setLoading(false);
  }

  if (done) return (
    <main className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h1 className="text-xl font-bold text-green-700 mb-2">Richiesta inviata!</h1>
      <p className="text-sm text-gray-600 mb-1">
        Riceverai <strong>{pkg?.tokens} token</strong> dopo verifica del bonifico.
      </p>
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5 text-left text-sm">
        <p className="font-semibold text-gray-800 mb-3">Dati bonifico</p>
        <div className="space-y-2 text-gray-600">
          <div className="flex justify-between">
            <span>Intestatario</span><span className="font-medium text-gray-800">{FTC_INTESTATO}</span>
          </div>
          <div className="flex justify-between">
            <span>IBAN</span><span className="font-mono text-xs text-gray-800">{FTC_IBAN}</span>
          </div>
          <div className="flex justify-between">
            <span>Importo</span><span className="font-bold text-indigo-700">€{pkg?.eur}</span>
          </div>
          <div className="flex justify-between">
            <span>Causale</span><span className="font-medium text-gray-800">Ricarica FTC {pkg?.tokens} token</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Tempi medi di accredito: 1–2 giorni lavorativi dopo ricezione bonifico.
      </p>
      <button
        onClick={() => { setDone(false); setSelected(null); }}
        className="mt-6 w-full border border-gray-300 py-3 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
      >
        Nuova ricarica
      </button>
    </main>
  );

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-1">Ricarica token</h1>
      <p className="text-sm text-gray-500 mb-6">Scegli il pacchetto e come vuoi pagare.</p>

      {/* Pacchetti */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {TOPUP_PACKAGES.map((p, i) => {
          const isSelected = selected === i;
          const isBest = p.label === "Plus";
          return (
            <button key={i} onClick={() => setSelected(i)}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                isSelected ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300"
              }`}
            >
              {isBest && (
                <span className="absolute -top-2.5 left-3 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  ⭐ Consigliato
                </span>
              )}
              <p className="text-base font-bold text-gray-900 mt-1">{p.label}</p>
              <p className="text-2xl font-bold text-indigo-700 mt-1">€{p.eur}</p>
              <p className="text-sm text-gray-600 mt-1">{p.tokens.toLocaleString()} token</p>
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Metodo pagamento */}
      {selected !== null && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700">Come vuoi pagare?</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMethod("bank")}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                method === "bank" ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300"
              }`}
            >
              <span className="text-2xl">🏦</span>
              <p className="text-sm font-semibold text-gray-800 mt-2">Bonifico</p>
              <p className="text-xs text-gray-500 mt-0.5">1–2 giorni lavorativi</p>
            </button>
            <button onClick={() => setMethod("card")}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                method === "card" ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300"
              }`}
            >
              <span className="text-2xl">💳</span>
              <p className="text-sm font-semibold text-gray-800 mt-2">Carta / Apple Pay</p>
              <p className="text-xs text-gray-500 mt-0.5">Immediato via Stripe</p>
            </button>
          </div>

          {/* Riepilogo */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Pacchetto</span>
              <span className="font-medium">{pkg?.label}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Importo</span>
              <span className="font-bold text-indigo-700">€{pkg?.eur}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-1">
              <span className="text-gray-600">Ricevi</span>
              <span className="font-bold text-green-700">+{pkg?.tokens.toLocaleString()} token</span>
            </div>
          </div>

          {/* Info bonifico */}
          {method === "bank" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-1.5">
              <p className="font-semibold text-blue-800 mb-2">📋 Dati per il bonifico</p>
              <div className="flex justify-between">
                <span className="text-blue-700">Intestatario</span>
                <span className="font-medium text-blue-900">{FTC_INTESTATO}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">IBAN</span>
                <span className="font-mono text-xs text-blue-900">{FTC_IBAN}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Causale obbligatoria</span>
                <span className="font-medium text-blue-900">Ricarica FTC {pkg?.tokens} token</span>
              </div>
            </div>
          )}

          {method === "card" && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
              <p>💳 Verrai reindirizzato a Stripe per completare il pagamento in sicurezza.</p>
              <p className="text-xs text-green-600 mt-1">Accettiamo Visa, Mastercard, Apple Pay, Google Pay.</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

          <button
            onClick={method === "bank" ? handleBankSubmit : handleCardSubmit}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl text-base font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Elaborazione..." : method === "bank" ? "Ho effettuato il bonifico" : `Paga €${pkg?.eur} con carta`}
          </button>

          <p className="text-xs text-gray-400 text-center">
            {method === "bank" ? "Premi dopo aver eseguito il bonifico dalla tua banca." : "Pagamento sicuro certificato Stripe."}
          </p>
        </div>
      )}
    </main>
  );
}
