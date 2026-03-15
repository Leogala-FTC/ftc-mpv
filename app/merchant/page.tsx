"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";

type Profile = {
  business_name: string | null;
  city: string | null;
  sector: string | null;
};

type Transaction = {
  id: string;
  direction: "in" | "out";
  amount_tokens: number;
  reason: string | null;
  created_at: string;
};

type ClearingRequest = {
  id: string;
  eur_amount: number;
  status: string;
  created_at: string;
};

export default function MerchantPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clearings, setClearings] = useState<ClearingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/"); return; }

      const uid = authData.user.id;

      const [{ data: prof }, { data: wallet }, { data: txs }, { data: clears }] = await Promise.all([
        supabase.from("profiles").select("business_name,city,sector,onboarding_completed,suspended").eq("user_id", uid).single(),
        supabase.from("wallets").select("token_balance").eq("profile_user_id", uid).single(),
        supabase.from("token_transactions").select("id,direction,amount_tokens,reason,created_at")
          .eq("profile_user_id", uid).order("created_at", { ascending: false }).limit(5),
        supabase.from("clearing_requests").select("id,eur_amount,status,created_at")
          .eq("merchant_user_id", uid).order("created_at", { ascending: false }).limit(3),
      ]);

      if (prof?.suspended) { router.push("/?error=suspended"); return; }
      if (!prof?.onboarding_completed) { router.push("/onboarding"); return; }

      setProfile(prof);
      setTokenBalance(Number(wallet?.token_balance) || 0);
      setTransactions(txs ?? []);
      setClearings(clears ?? []);
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-8"><p className="text-sm text-gray-500">Caricamento...</p></main>;

  const statusLabel: Record<string, string> = {
    pending: "In attesa",
    approved: "Approvata",
    rejected: "Rifiutata",
    paid: "Pagata",
  };
  const statusColor: Record<string, string> = {
    pending: "text-yellow-600 bg-yellow-50",
    approved: "text-green-600 bg-green-50",
    rejected: "text-red-600 bg-red-50",
    paid: "text-indigo-600 bg-indigo-50",
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{profile?.business_name ?? "Dashboard Merchant"}</h1>
        {profile?.city && <p className="text-sm text-gray-500 mt-1">{profile.city}{profile.sector ? ` · ${profile.sector}` : ""}</p>}
      </div>

      {/* Saldo */}
      <div className="rounded-xl bg-black text-white p-6">
        <p className="text-sm opacity-70 mb-1">Saldo disponibile</p>
        <p className="text-4xl font-bold">€{(tokenBalance / 11.7).toFixed(2)}</p>
        <p className="text-sm opacity-50 mt-2">
          {tokenBalance.toLocaleString("it-IT")} token
        </p>
      </div>

      {/* Azioni */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/merchant/sell" className="flex flex-col rounded-lg border border-gray-200 bg-white px-4 py-4 hover:bg-gray-50">
          <span className="text-lg">🛒</span>
          <p className="text-sm font-medium mt-2">Registra vendita</p>
          <p className="text-xs text-gray-500 mt-0.5">Cashback al cliente (POS €)</p>
        </Link>
        <Link href="/merchant/request-payment" className="flex flex-col rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-4 hover:bg-indigo-100">
          <span className="text-lg">🪙</span>
          <p className="text-sm font-medium mt-2 text-indigo-800">Incassa in Token</p>
          <p className="text-xs text-indigo-500 mt-0.5">Genera QR · cliente paga in token</p>
        </Link>
        <Link href="/merchant/clearing" className="flex flex-col rounded-lg border border-gray-200 bg-white px-4 py-4 hover:bg-gray-50 col-span-2">
          <span className="text-lg">💶</span>
          <p className="text-sm font-medium mt-2">Richiedi prelievo</p>
          <p className="text-xs text-gray-500 mt-0.5">Trasferisci € sul tuo IBAN</p>
        </Link>
      </div>

      {/* Ultime transazioni buyer */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Movimenti cashback erogati</h2>
          <ul className="space-y-2">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
                <div>
                  <p className="text-sm text-gray-800">{tx.reason ?? "Transazione"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${tx.direction === "in" ? "text-green-600" : "text-red-500"}`}>
                  {tx.direction === "in" ? "+" : "−"}{tx.amount_tokens} token
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ultime richieste prelievo */}
      {clearings.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Ultime richieste prelievo</h2>
          <ul className="space-y-2">
            {clearings.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
                <div>
                  <p className="text-sm text-gray-800">€{Number(c.eur_amount).toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(c.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor[c.status] ?? "text-gray-600 bg-gray-50"}`}>
                  {statusLabel[c.status] ?? c.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
