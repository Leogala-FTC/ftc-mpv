"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";

const TOKENS_PER_EURO = 11.7;

type Transaction = {
  id: string;
  direction: "in" | "out";
  amount_tokens: number;
  reason: string | null;
  created_at: string;
};

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/"); return; }

      const uid = authData.user.id;
      const [{ data: wallet }, { data: txs }] = await Promise.all([
        supabase.from("wallets").select("token_balance").eq("profile_user_id", uid).single(),
        supabase.from("token_transactions").select("id,direction,amount_tokens,reason,created_at")
          .eq("profile_user_id", uid).order("created_at", { ascending: false }),
      ]);

      setBalance(wallet?.token_balance ?? 0);
      setTransactions(txs ?? []);
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-8"><p className="text-sm text-gray-500">Caricamento...</p></main>;

  const totalIn = transactions.filter(t => t.direction === "in").reduce((s, t) => s + t.amount_tokens, 0);
  const totalOut = transactions.filter(t => t.direction === "out").reduce((s, t) => s + t.amount_tokens, 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Wallet</h1>

      {/* Card saldo */}
      <div className="rounded-xl bg-black text-white p-6">
        <p className="text-sm opacity-70">Saldo attuale</p>
        <p className="text-4xl font-bold mt-1">{balance.toLocaleString("it-IT")} <span className="text-xl font-normal">token</span></p>
        <p className="text-sm opacity-60 mt-1">≈ €{(balance / TOKENS_PER_EURO).toFixed(2)}</p>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Totale ricevuti</p>
          <p className="text-lg font-semibold text-green-600 mt-1">+{totalIn.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Totale usati</p>
          <p className="text-lg font-semibold text-red-500 mt-1">−{totalOut.toLocaleString()}</p>
        </div>
      </div>

      {/* Lista movimenti */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Tutti i movimenti</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Nessun movimento ancora.</p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${tx.direction === "in" ? "text-green-500" : "text-red-400"}`}>
                    {tx.direction === "in" ? "↓" : "↑"}
                  </span>
                  <div>
                    <p className="text-sm text-gray-800">{tx.reason ?? (tx.direction === "in" ? "Cashback ricevuto" : "Token utilizzati")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${tx.direction === "in" ? "text-green-600" : "text-red-500"}`}>
                    {tx.direction === "in" ? "+" : "−"}{tx.amount_tokens}
                  </p>
                  <p className="text-xs text-gray-400">≈ €{(tx.amount_tokens / TOKENS_PER_EURO).toFixed(2)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
