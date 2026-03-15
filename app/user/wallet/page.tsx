"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";


type Transaction = {
  id: string;
  direction: "in" | "out";
  amount_tokens: number;
  reason: string | null;
  created_at: string;
};

// Analizza la reason per estrarre provenienza e tipo leggibile
function parseReason(reason: string | null, direction: "in" | "out"): {
  label: string;
  source: string;
  icon: string;
} {
  if (!reason) return { label: direction === "in" ? "Cashback ricevuto" : "Token utilizzati", source: "", icon: direction === "in" ? "💚" : "🔴" };

  const r = reason.toLowerCase();

  if (r.includes("ricarica") || r.includes("topup") || r.includes("bonifico") || r.includes("stripe")) {
    return { label: "Ricarica token", source: "Acquisto FTC", icon: "🪙" };
  }
  if (r.includes("cashback") || r.includes("vendita")) {
    // Estrai nome merchant dalla reason se presente
    const match = reason.match(/da (.+?) —|da (.+?)$/) ?? reason.match(/cashback (.+)/i);
    const merchantName = match ? (match[1] ?? match[2] ?? "").trim() : "";
    return { label: "Cashback ricevuto", source: merchantName || "Esercente FTC", icon: "🎁" };
  }
  if (r.includes("pagamento token") || r.includes("incasso token")) {
    const match = reason.match(/€([\d.]+)/);
    const eur = match ? `€${match[1]}` : "";
    return {
      label: direction === "out" ? "Pagamento in token" : "Incasso token",
      source: eur,
      icon: direction === "out" ? "📤" : "📥",
    };
  }
  if (r.includes("referral")) {
    return { label: "Bonus referral", source: "Programma referral", icon: "🔗" };
  }
  if (r.includes("admin") || r.includes("manuale")) {
    return { label: "Accredito manuale", source: "FTC Admin", icon: "⚙️" };
  }

  return { label: reason.length > 50 ? reason.slice(0, 50) + "…" : reason, source: "", icon: direction === "in" ? "⬇️" : "⬆️" };
}

type FilterType = "all" | "in" | "out";

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [router]);

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-8"><p className="text-sm text-gray-500">Caricamento...</p></main>;

  const totalIn = transactions.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount_tokens, 0);
  const totalOut = transactions.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount_tokens, 0);
  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.direction === filter);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <Link href="/user/topup" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700">
          + Ricarica
        </Link>
      </div>

      {/* Card saldo */}
      <div className="rounded-xl bg-black text-white p-6">
        <p className="text-sm opacity-70">Saldo attuale</p>
        <p className="text-4xl font-bold mt-1">{balance.toLocaleString("it-IT")} <span className="text-xl font-normal">token</span></p>
        <p className="text-sm opacity-60 mt-1">token FTC</p>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-100 bg-white px-3 py-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Ricevuti</p>
          <p className="text-base font-bold text-green-600">+{totalIn.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-3 py-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Usati</p>
          <p className="text-base font-bold text-red-500">−{totalOut.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white px-3 py-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Operazioni</p>
          <p className="text-base font-bold text-gray-700">{transactions.length}</p>
        </div>
      </div>

      {/* Lista movimenti */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Movimenti</h2>
          {/* Filtro */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(["all", "in", "out"] as FilterType[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}>
                {f === "all" ? "Tutti" : f === "in" ? "Entrate" : "Uscite"}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Nessun movimento.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((tx) => {
              const { label, source, icon } = parseReason(tx.reason, tx.direction);
              return (
                <li key={tx.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 gap-3">
                  {/* Icona */}
                  <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 text-lg">
                    {icon}
                  </div>
                  {/* Descrizione */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 leading-tight">{label}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {source && (
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                          {source}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  {/* Importo */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${tx.direction === "in" ? "text-green-600" : "text-red-500"}`}>
                      {tx.direction === "in" ? "+" : "−"}{tx.amount_tokens.toLocaleString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
