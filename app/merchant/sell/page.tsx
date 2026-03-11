"use client";

import { useState } from "react";
import { createPayment, findUserByEmail } from "@/app/actions/payments";

const TOKENS_PER_EURO = 11.7;
const FTC_FEE_RATE = 0.05;

export default function MerchantSellPage() {
  const [emailInput, setEmailInput] = useState("");
  const [buyer, setBuyer] = useState<{ userId: string; displayName: string; email: string } | null>(null);
  const [emailError, setEmailError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const [amountEur, setAmountEur] = useState("");
  const [cashbackPercent, setCashbackPercent] = useState(5);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean; message: string; qr?: string;
  } | null>(null);

  const amount = parseFloat(amountEur) || 0;
  const ftcFee = amount * FTC_FEE_RATE;
  const cashbackEur = amount * (cashbackPercent / 100);
  const merchantEur = amount - ftcFee - cashbackEur;
  const cashbackTokens = Math.floor(cashbackEur * TOKENS_PER_EURO);

  async function handleSearchEmail() {
    if (!emailInput.trim()) return;
    setSearchLoading(true);
    setEmailError("");
    setBuyer(null);
    const res = await findUserByEmail(emailInput.trim());
    if (res.success) {
      setBuyer({ userId: res.userId, displayName: res.displayName, email: emailInput.trim() });
    } else {
      setEmailError(res.error ?? "Cliente non trovato");
    }
    setSearchLoading(false);
  }

  async function handleSubmit() {
    if (!buyer || amount <= 0) return;
    setLoading(true);
    setResult(null);

    const res = await createPayment({
      buyerUserId: buyer.userId,
      amountEur: amount,
      cashbackPercent,
      merchantNote: note || undefined,
    });

    if (res.success && "paymentId" in res) {
      setResult({
        success: true,
        message: `✓ Pagamento registrato! ${buyer.displayName || buyer.email} riceve ${res.cashbackTokens} token di cashback. Il tuo saldo cresce di €${res.merchantEur?.toFixed(2)}.`,
        qr: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
          JSON.stringify({ paymentId: res.paymentId, tokens: res.cashbackTokens, eur: amount })
        )}&size=200x200`,
      });
      setBuyer(null);
      setEmailInput("");
      setAmountEur("");
      setCashbackPercent(5);
      setNote("");
    } else {
      const errMsg = "error" in res ? res.error : "Errore sconosciuto";
      setResult({ success: false, message: errMsg ?? "Errore sconosciuto" });
    }
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Registra Vendita</h1>

      {/* Step 1: cliente */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">1. Identifica il cliente</p>

        {!buyer ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchEmail()}
                placeholder="email@cliente.it"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSearchEmail}
                disabled={searchLoading || !emailInput.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searchLoading ? "..." : "Cerca"}
              </button>
            </div>
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-green-800">{buyer.displayName || buyer.email}</p>
              <p className="text-xs text-green-600">{buyer.email}</p>
            </div>
            <button onClick={() => { setBuyer(null); setEmailInput(""); }} className="text-xs text-gray-400 hover:text-red-500 ml-3">
              ✕ cambia
            </button>
          </div>
        )}
      </div>

      {/* Step 2: importo e cashback */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">2. Importo e cashback</p>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Totale pagato dal cliente (€)</label>
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
          <div className="flex justify-between text-sm mb-1">
            <label className="text-gray-600">Cashback al cliente</label>
            <span className="font-semibold text-indigo-600">{cashbackPercent}%</span>
          </div>
          <input
            type="range"
            min={3}
            max={20}
            value={cashbackPercent}
            onChange={(e) => setCashbackPercent(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>3%</span><span>20%</span>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Nota (opzionale)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="es. Cena tavolo 4"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Preview distribuzione */}
      {amount > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-sm space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Distribuzione pagamento</p>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-base">💼</span>
              <div>
                <p className="text-gray-700 font-medium">Al tuo saldo ({100 - 5 - cashbackPercent}%)</p>
                <p className="text-xs text-gray-400">→ wallet merchant, prelevabile</p>
              </div>
            </div>
            <span className="font-bold text-green-700">€{merchantEur.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-base">🏦</span>
              <div>
                <p className="text-gray-700">Commissione FTC (5%)</p>
                <p className="text-xs text-gray-400">→ piattaforma</p>
              </div>
            </div>
            <span className="font-medium text-gray-600">€{ftcFee.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center border-t pt-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🎁</span>
              <div>
                <p className="text-gray-700 font-medium">Cashback cliente ({cashbackPercent}%)</p>
                <p className="text-xs text-gray-400">→ €{cashbackEur.toFixed(2)} convertiti in token</p>
              </div>
            </div>
            <span className="font-bold text-indigo-600">{cashbackTokens} token</span>
          </div>

          <div className="flex justify-between border-t pt-2 text-xs text-gray-400">
            <span>Totale pagato</span>
            <span className="font-medium">€{amount.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !buyer || amount <= 0}
        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Elaborazione..." : "✓ Conferma Pagamento"}
      </button>

      {result && (
        <div className={`mt-6 p-4 rounded-xl ${
          result.success ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          <p className="text-sm font-medium">{result.message}</p>
          {result.qr && result.success && (
            <div className="mt-4 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.qr} alt="QR ricevuta" width={180} height={180} className="rounded-lg" />
              <p className="text-xs text-gray-500 text-center mt-2">QR ricevuta</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
