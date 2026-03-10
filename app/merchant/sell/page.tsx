"use client";

import { useState } from "react";
import { createPayment } from "@/app/actions/payments";

const TOKENS_PER_EURO = 11.7;
const FEE_RATE = 0.05;

export default function MerchantSellPage() {
  const [buyerUserId, setBuyerUserId] = useState("");
  const [amountEur, setAmountEur] = useState("");
  const [cashbackPercent, setCashbackPercent] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    qr?: string;
  } | null>(null);

  const amount = parseFloat(amountEur) || 0;
  const fee = amount * FEE_RATE;
  const cashbackTokens = Math.floor(amount * (cashbackPercent / 100) * TOKENS_PER_EURO);

  async function handleSubmit() {
    if (!buyerUserId || amount <= 0) return;
    setLoading(true);
    setResult(null);

    const res = await createPayment({
      buyerUserId,
      amountEur: amount,
      cashbackPercent,
    });

    if (res.success) {
      setResult({
        success: true,
        message: `Pagamento completato! ${res.cashbackTokens} token accreditati al cliente.`,
        qr: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
          JSON.stringify({ paymentId: res.paymentId, tokens: res.cashbackTokens })
        )}&size=200x200`,
      });
      setBuyerUserId("");
      setAmountEur("");
      setCashbackPercent(5);
    } else {
      setResult({ success: false, message: res.error ?? "Errore sconosciuto" });
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Registra Vendita</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            UUID Cliente
          </label>
          <input
            type="text"
            value={buyerUserId}
            onChange={(e) => setBuyerUserId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Importo (€)
          </label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cashback: {cashbackPercent}%
          </label>
          <input
            type="range"
            min={3}
            max={20}
            value={cashbackPercent}
            onChange={(e) => setCashbackPercent(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>3%</span>
            <span>20%</span>
          </div>
        </div>

        {amount > 0 && (
          <div className="bg-gray-50 rounded-md p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Commissione (5%)</span>
              <span className="font-medium">€{fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cashback cliente</span>
              <span className="font-medium text-indigo-600">{cashbackTokens} token</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-gray-600">Totale incassato</span>
              <span className="font-semibold">€{amount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !buyerUserId || amount <= 0}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Elaborazione..." : "Conferma Pagamento"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-6 p-4 rounded-md ${
            result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          <p className="text-sm font-medium">{result.message}</p>
          {result.qr && (
            <div className="mt-3 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.qr} alt="QR ricevuta" width={200} height={200} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
