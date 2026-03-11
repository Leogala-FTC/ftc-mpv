"use client";

import { useState } from "react";
import { createTokenPaymentSession } from "@/app/actions/token-payment";
import { TOKENS_PER_EURO, TOKEN_FEE_RATE } from "@/lib/stripe";

export default function RequestPaymentPage() {
  const [amountEur, setAmountEur] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{
    sessionId: string; tokenAmount: number; feeTokens: number; totalTokens: number;
  } | null>(null);
  const [error, setError] = useState("");

  const amount = parseFloat(amountEur) || 0;
  const tokenAmount = Math.floor(amount * TOKENS_PER_EURO);
  const feeTokens = Math.ceil(tokenAmount * TOKEN_FEE_RATE);
  const totalTokens = tokenAmount + feeTokens;

  async function handleCreate() {
    if (amount <= 0) return;
    setLoading(true);
    setError("");
    const res = await createTokenPaymentSession(amount, note || undefined);
    if (res.success && "sessionId" in res) {
      setSession({ sessionId: res.sessionId, tokenAmount: res.tokenAmount ?? 0, feeTokens: res.feeTokens ?? 0, totalTokens: res.totalTokens ?? 0 });
    } else {
      setError(res.error ?? "Errore");
    }
    setLoading(false);
  }

  function handleReset() {
    setSession(null);
    setAmountEur("");
    setNote("");
  }

  const payUrl = session
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${session.sessionId}`
    : "";
  const qrUrl = payUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payUrl)}&size=240x240`
    : "";

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Richiedi Pagamento Token</h1>
      <p className="text-sm text-gray-500 mb-6">
        Il cliente paga in token FTC. FTC trattiene il 3% di fee, tu ricevi il valore pieno.
      </p>

      {!session ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Importo da incassare (€)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amountEur}
              onChange={(e) => setAmountEur(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opzionale)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="es. Cena tavolo 3"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {amount > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Riepilogo</p>
              <div className="flex justify-between">
                <span className="text-gray-600">💼 Ricevi (100%)</span>
                <span className="font-bold text-green-700">{tokenAmount.toLocaleString()} token</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">🏦 Fee FTC (3%) — a carico cliente</span>
                <span className="text-gray-500">{feeTokens.toLocaleString()} token</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-700 font-medium">🧾 Totale pagato dal cliente</span>
                <span className="font-bold text-indigo-700">{totalTokens.toLocaleString()} token</span>
              </div>
              <p className="text-xs text-gray-400 pt-1">
                ≈ €{(totalTokens / TOKENS_PER_EURO).toFixed(2)} in valore token
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading || amount <= 0}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Generazione QR..." : "Genera QR di pagamento"}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
            <p className="text-sm text-gray-500 mb-1">Il cliente deve scansionare</p>
            <p className="text-xl font-bold text-indigo-700 mb-4">
              {session.totalTokens.toLocaleString()} token
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="QR pagamento token"
              width={240}
              height={240}
              className="mx-auto rounded-xl"
            />
            <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Importo</span><span className="font-medium">€{amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>→ A te</span><span className="font-medium text-green-700">{session.tokenAmount.toLocaleString()} token</span>
              </div>
              <div className="flex justify-between">
                <span>→ Fee FTC (3%)</span><span>{session.feeTokens.toLocaleString()} token</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-4">Scade tra 15 minuti</p>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
            >
              Nuovo pagamento
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
