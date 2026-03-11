"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";
import { TOPUP_PACKAGES } from "@/lib/stripe";

export default function TopupPage() {
  const params = useSearchParams();
  const success = params.get("success");
  const cancelled = params.get("cancelled");
  const successTokens = params.get("tokens");

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<number | null>(null); // index pacchetto

  useEffect(() => {
    async function loadBalance() {
      const supabase = getSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: wallet } = await supabase
        .from("wallets").select("token_balance").eq("profile_user_id", auth.user.id).single();
      setBalance(wallet?.token_balance ?? 0);
    }
    loadBalance();
  }, []);

  async function handleBuy(packageIndex: number) {
    setLoading(packageIndex);
    try {
      const res = await fetch("/api/stripe/create-topup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageIndex }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Errore: " + (data.error ?? "Impossibile avviare il pagamento"));
        setLoading(null);
      }
    } catch {
      alert("Errore di rete");
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Ricarica Token</h1>
      <p className="text-sm text-gray-500 mb-6">
        Acquista token FTC con la tua carta di credito. Tasso fisso: 11.7 token = €1
      </p>

      {/* Banner successo */}
      {success && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-4">
          <p className="text-sm font-semibold text-green-800">✓ Pagamento completato!</p>
          {successTokens && (
            <p className="text-sm text-green-700 mt-1">
              {parseInt(successTokens).toLocaleString("it-IT")} token accreditati sul tuo wallet.
            </p>
          )}
        </div>
      )}
      {cancelled && (
        <div className="mb-6 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
          <p className="text-sm text-yellow-800">Pagamento annullato.</p>
        </div>
      )}

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

      {/* Pacchetti */}
      <div className="grid grid-cols-2 gap-3">
        {TOPUP_PACKAGES.map((pkg, i) => (
          <button
            key={i}
            onClick={() => handleBuy(i)}
            disabled={loading !== null}
            className={`relative flex flex-col items-center rounded-xl border-2 px-4 py-5 transition-all
              ${i === 2 ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50"}
              disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {i === 2 && (
              <span className="absolute -top-2.5 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">
                Più popolare
              </span>
            )}
            <p className="text-2xl font-bold text-gray-900">€{pkg.eur}</p>
            <p className="text-sm font-semibold text-indigo-600 mt-1">
              {pkg.tokens.toLocaleString("it-IT")} token
            </p>
            <p className="text-xs text-gray-400 mt-1">{pkg.label}</p>
            {loading === i && (
              <p className="text-xs text-indigo-500 mt-2">Reindirizzamento...</p>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        Pagamento sicuro tramite Stripe · I token non scadono
      </p>
    </main>
  );
}
