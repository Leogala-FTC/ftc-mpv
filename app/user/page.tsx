"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";
import { getTopMerchants } from "@/app/actions/settings";

const TOKENS_PER_EURO = 11.7;

type Transaction = { id: string; direction: "in"|"out"; amount_tokens: number; reason: string|null; created_at: string };
type Merchant = { userId: string; name: string; sector: string; city: string; cashbackPercent: number };

const SECTOR_EMOJI: Record<string, string> = {
  bar: "☕", ristorante: "🍽️", pizzeria: "🍕", supermercato: "🛒",
  abbigliamento: "👗", farmacia: "💊", parrucchiere: "✂️", palestra: "💪",
  hotel: "🏨", tabaccheria: "🚬", panificio: "🥖", pasticceria: "🍰",
};

export default function UserPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topMerchants, setTopMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/"); return; }
      const uid = authData.user.id;

      const [{ data: prof }, { data: wallet }, { data: txs }, merchants] = await Promise.all([
        supabase.from("profiles").select("full_name,alias,show_alias_only,city,onboarding_completed,suspended").eq("user_id", uid).single(),
        supabase.from("wallets").select("token_balance").eq("profile_user_id", uid).single(),
        supabase.from("token_transactions").select("id,direction,amount_tokens,reason,created_at")
          .eq("profile_user_id", uid).order("created_at", { ascending: false }).limit(5),
        getTopMerchants(10),
      ]);

      if (prof?.suspended) { router.push("/?error=suspended"); return; }
      if (!prof?.onboarding_completed) { router.push("/onboarding"); return; }

      setDisplayName(
        prof?.show_alias_only && prof.alias ? prof.alias : prof?.full_name ?? "Utente"
      );
      setCity(prof?.city ?? "");
      setBalance(wallet?.token_balance ?? 0);
      setTransactions(txs ?? []);
      setTopMerchants(merchants);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-8"><p className="text-sm text-gray-500">Caricamento...</p></main>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ciao, {displayName} 👋</h1>
        {city && <p className="text-sm text-gray-500 mt-1">{city}</p>}
      </div>

      {/* Saldo */}
      <div className="rounded-xl bg-black text-white p-6">
        <p className="text-sm opacity-70">Saldo FTC</p>
        <p className="text-4xl font-bold mt-1">{balance.toLocaleString("it-IT")} <span className="text-xl font-normal">token</span></p>
        <p className="text-sm opacity-60 mt-1">≈ €{(balance / TOKENS_PER_EURO).toFixed(2)}</p>
      </div>

      {/* CTA rapide */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/user/wallet" className="flex flex-col rounded-lg border border-gray-200 bg-white px-4 py-4 hover:bg-gray-50">
          <span className="text-lg">💳</span>
          <p className="text-sm font-medium mt-2">Wallet</p>
          <p className="text-xs text-gray-500 mt-0.5">Tutti i movimenti</p>
        </Link>
        <Link href="/user/topup" className="flex flex-col rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-4 hover:bg-indigo-100">
          <span className="text-lg">🪙</span>
          <p className="text-sm font-medium mt-2 text-indigo-800">Ricarica</p>
          <p className="text-xs text-indigo-500 mt-0.5">Acquista token FTC</p>
        </Link>
      </div>

      {/* Classifica top merchant cashback */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">🏆 Top esercenti questa settimana</h2>
          <span className="text-xs text-gray-400">per % cashback</span>
        </div>

        {topMerchants.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-center">
            <p className="text-sm text-gray-400">Nessun esercente ha ancora impostato il cashback.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {topMerchants.map((m, i) => (
              <li key={m.userId} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
                {/* Posizione */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? "bg-yellow-400 text-yellow-900" :
                  i === 1 ? "bg-gray-300 text-gray-700" :
                  i === 2 ? "bg-orange-300 text-orange-900" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {i + 1}
                </div>
                {/* Emoji settore */}
                <span className="text-xl flex-shrink-0">
                  {SECTOR_EMOJI[m.sector?.toLowerCase()] ?? "🏪"}
                </span>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{m.name}</p>
                  <p className="text-xs text-gray-400">
                    {[m.sector, m.city].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {/* % cashback */}
                <div className="flex-shrink-0 text-right">
                  <span className="inline-block bg-green-100 text-green-700 text-sm font-bold px-2.5 py-1 rounded-full">
                    {m.cashbackPercent}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ultimi movimenti */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Ultimi movimenti</h2>
          <Link href="/user/wallet" className="text-xs text-indigo-600 hover:underline">Vedi tutti</Link>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Nessuna transazione ancora. Usa FTC nei locali convenzionati!</p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base">{tx.direction === "in" ? "⬇️" : "⬆️"}</span>
                  <div>
                    <p className="text-sm text-gray-800">{tx.reason ?? (tx.direction === "in" ? "Cashback ricevuto" : "Token utilizzati")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.direction === "in" ? "text-green-600" : "text-red-500"}`}>
                  {tx.direction === "in" ? "+" : "−"}{tx.amount_tokens.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
