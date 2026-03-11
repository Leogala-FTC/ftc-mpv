"use client";

import { useState, useEffect } from "react";
import { createClearingRequest } from "@/app/actions/clearing";
import { getSupabaseClient } from "@/lib/supabase-client";

const TOKENS_PER_EURO = 11.7;

export default function MerchantClearingPage() {
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function loadBalance() {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data: wallet } = await supabase
        .from("wallets")
        .select("token_balance")
        .eq("profile_user_id", authData.user.id)
        .single();
      setTokenBalance(wallet?.token_balance ?? 0);
      setLoadingBalance(false);
    }
    loadBalance();
  }, [result]);

  const tokens = parseInt(tokenAmount) || 0;
  const eurPreview = tokens > 0 ? (tokens / TOKENS_PER_EURO).toFixed(2) : "0.00";
  const maxTokens = tokenBalance ?? 0;
  const isOverBalance = tokens > maxTokens;

  async function handleSubmit() {
    if (tokens <= 0 || isOverBalance) return;
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
      <h1 className="text-2xl font-semibold mb-2">Richiedi Clearing</h1>
      <p className="text-sm text-gray-600 mb-6">
        Converti i tuoi token in euro. Il pagamento verrà effettuato sul tuo IBAN registrato.
      </p>

      {/* Saldo Card */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6">
        <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mb-1">Saldo disponibile</p>
        {loadingBalance ? (
          <div className="h-8 w-32 bg-indigo-100 animate-pulse rounded" />
        ) : (
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-indigo-700">
              {maxTokens.toLocaleString("it-IT")}
            </span>
            <span className="text-indigo-500 mb-1 text-sm">token</span>
            <span className="text-gray-400 mb-1 text-sm">
              ≈ €{(maxTokens / TOKENS_PER_EURO).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Token da convertire
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              step="1"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder="0"
              className={`flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isOverBalance ? "border-red-400 bg-red-50" : "border-gray-300"
              }`}
            />
            <button
              type="button"
              onClick={() => setTokenAmount(String(maxTokens))}
              disabled={maxTokens === 0}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-md hover:bg-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              MAX
            </button>
          </div>
          {isOverBalance && (
            <p className="text-xs text-red-500 mt-1">
              Saldo insufficiente. Massimo: {maxTokens.toLocaleString("it-IT")} token
            </p>
          )}
        </div>

        {tokens > 0 && !isOverBalance && (
          <div className="bg-gray-50 rounded-md p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Valore in euro</span>
              <span className="font-semibold text-indigo-600">€{eurPreview}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Token rimanenti</span>
              <span className="font-medium">{(maxTokens - tokens).toLocaleString("it-IT")}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Tasso: {TOKENS_PER_EURO} token = €1
            </p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || tokens <= 0 || isOverBalance || loadingBalance}
          className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Invio in corso..." : "Richiedi Clearing"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-6 p-4 rounded-md text-sm ${
            result.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {result.message}
        </div>
      )}
    </main>
  );
}
