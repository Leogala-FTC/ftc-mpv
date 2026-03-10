"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";

const TOKENS_PER_EURO = 11.7;

type Profile = {
  full_name: string | null;
  alias: string | null;
  show_alias_only: boolean | null;
  city: string | null;
};

type Transaction = {
  id: string;
  direction: "in" | "out";
  amount_tokens: number;
  reason: string | null;
  created_at: string;
};

export default function UserPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/"); return; }

      const uid = authData.user.id;

      const [{ data: prof }, { data: wallet }, { data: txs }] = await Promise.all([
        supabase.from("profiles").select("full_name,alias,show_alias_only,city").eq("user_id", uid).single(),
        supabase.from("wallets").select("token_balance").eq("profile_user_id", uid).single(),
        supabase.from("token_transactions").select("id,direction,amount_tokens,reason,created_at")
          .eq("profile_user_id", uid).order("created_at", { ascending: false }).limit(5),
      ]);

      setProfile(prof);
      setBalance(wallet?.token_balance ?? 0);
      setTransactions(txs ?? []);
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-8"><p className="text-sm text-gray-500">Caricamento...</p></main>;

  const displayName = profile?.show_alias_only && profile.alias
    ? profile.alias
    : profile?.full_name ?? "Utente";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ciao, {displayName} 👋</h1>
        {profile?.city && <p className="text-sm text-gray-500 mt-1">{profile.city}</p>}
      </div>

      <div className="rounded-xl bg-black text-white p-6">
        <p className="text-sm opacity-70">Saldo FTC</p>
        <p className="text-4xl font-bold mt-1">{balance.toLocaleString("it-IT")} <span className="text-xl font-normal">token</span></p>
        <p className="text-sm opacity-60 mt-1">≈ €{(balance / TOKENS_PER_EURO).toFixed(2)}</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Link
          href="/user/wallet"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-4 hover:bg-gray-50"
        >
          <div>
            <p className="text-sm font-medium">Wallet completo</p>
            <p className="text-xs text-gray-500 mt-0.5">Vedi tutti i movimenti token</p>
          </div>
          <span className="text-gray-400">→</span>
        </Link>
      </div>

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
                <div>
                  <p className="text-sm text-gray-800">{tx.reason ?? (tx.direction === "in" ? "Cashback ricevuto" : "Token utilizzati")}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${tx.direction === "in" ? "text-green-600" : "text-red-500"}`}>
                  {tx.direction === "in" ? "+" : "−"}{tx.amount_tokens}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
