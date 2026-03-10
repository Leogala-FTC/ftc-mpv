"use client";

import { useState } from "react";
import { createClearingRequest } from "@/app/actions/clearing";

const TOKENS_PER_EURO = 11.7;

export default function MerchantClearingPage() {
  const [tokenAmount, setTokenAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const tokens = parseInt(tokenAmount) || 0;
  const eurPreview = tokens > 0 ? (tokens / TOKENS_PER_EURO).toFixed(2) : "0.00";

  async function handleSubmit() {
    if (tokens <= 0) return;
    setLoading(true);
    setResult(null);

    const res = await createClearingRequest(tokens);

    if (res.success) {
      setResult({
        success: true,
        message: `Richiesta inviata! Riceverai €${res.eurAmount?.toFixed(2)} sul tuo IBAN.`,
      });
      setTokenAmount("");
    } else {
      setResult({ success: false, message: res.error ?? "Errore sconosciuto" });
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Richiedi Clearing</h1>
      <p className="text-sm text-gray-600 mb-6">
        Converti i tuoi token in euro. Il pagamento verrà effettuato sul tuo IBAN registrato.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Token da convertire
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {tokens > 0 && (
          <div className="bg-gray-50 rounded-md p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Valore in euro</span>
              <span className="font-semibold text-indigo-600">€{eurPreview}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Tasso: {TOKENS_PER_EURO} token = €1
            </p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || tokens <= 0}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Invio in corso..." : "Richiedi Clearing"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-6 p-4 rounded-md text-sm ${
            result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {result.message}
        </div>
      )}
    </main>
  );
}
