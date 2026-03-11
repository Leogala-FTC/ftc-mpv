"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";
import { getAdminUsers, getAdminPayments, getAdminClearings, updateClearingStatus as updateClearingStatusAction } from "@/app/actions/admin";

type Tab = "users" | "payments" | "clearing";

type UserRow = {
  user_id: string;
  role: string | null;
  full_name: string | null;
  business_name: string | null;
  city: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  amount_eur: number;
  fee_eur: number;
  cashback_tokens: number;
  cashback_percent: number;
  status: string;
  created_at: string;
  merchant_user_id: string;
  buyer_user_id: string;
};

type ClearingRow = {
  id: string;
  token_amount: number;
  eur_amount: number;
  status: string;
  iban: string | null;
  created_at: string;
  merchant_user_id: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [clearings, setClearings] = useState<ClearingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/"); return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("user_id", authData.user.id).single();

      if (profile?.role !== "admin") { router.push("/"); return; }

      try {
        const [u, p, c] = await Promise.all([
          getAdminUsers(),
          getAdminPayments(),
          getAdminClearings(),
        ]);
        setUsers(u);
        setPayments(p);
        setClearings(c);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const updateClearingStatus = async (id: string, status: string) => {
    const res = await updateClearingStatusAction(id, status);
    if (!res.success) { setActionMsg("Errore: " + res.error); return; }
    setClearings((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    setActionMsg(`Richiesta aggiornata → ${status}`);
    setTimeout(() => setActionMsg(null), 3000);
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

  const statusColor: Record<string, string> = {
    pending: "text-yellow-700 bg-yellow-50",
    approved: "text-green-700 bg-green-50",
    rejected: "text-red-700 bg-red-50",
    paid: "text-indigo-700 bg-indigo-50",
    completed: "text-green-700 bg-green-50",
  };

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8"><p className="text-sm text-gray-500">Caricamento...</p></main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        {users.length} utenti · {payments.length} pagamenti · {clearings.filter(c => c.status === "pending").length} clearing in attesa
      </p>

      {actionMsg && (
        <div className="mb-4 rounded bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{actionMsg}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(["users", "payments", "clearing"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-black text-black" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "users" ? "Utenti" : t === "payments" ? "Pagamenti" : "Clearing"}
          </button>
        ))}
      </div>

      {/* USERS */}
      {tab === "users" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Nome / Ragione sociale</th>
                <th className="pb-2 pr-4 font-medium">Ruolo</th>
                <th className="pb-2 pr-4 font-medium">Città</th>
                <th className="pb-2 pr-4 font-medium">Onboarding</th>
                <th className="pb-2 font-medium">Registrato</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{u.full_name ?? u.business_name ?? <span className="text-gray-400">—</span>}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === "admin" ? "bg-purple-50 text-purple-700" :
                      u.role === "merchant" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                    }`}>{u.role ?? "—"}</span>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{u.city ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {u.onboarding_completed
                      ? <span className="text-green-600 text-xs">✓ Completato</span>
                      : <span className="text-yellow-600 text-xs">⏳ Pendente</span>}
                  </td>
                  <td className="py-2 text-gray-500 text-xs">{fmt(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAYMENTS */}
      {tab === "payments" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Data</th>
                <th className="pb-2 pr-4 font-medium">Importo</th>
                <th className="pb-2 pr-4 font-medium">Commissione</th>
                <th className="pb-2 pr-4 font-medium">Cashback</th>
                <th className="pb-2 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-500 text-xs">{fmt(p.created_at)}</td>
                  <td className="py-2 pr-4 font-medium">€{Number(p.amount_eur).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-gray-600">€{Number(p.fee_eur).toFixed(2)}</td>
                  <td className="py-2 pr-4 text-indigo-600">{p.cashback_tokens} token ({p.cashback_percent}%)</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[p.status] ?? "bg-gray-50 text-gray-600"}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CLEARING */}
      {tab === "clearing" && (
        <div className="space-y-3">
          {clearings.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-100 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{c.token_amount.toLocaleString()} token → €{Number(c.eur_amount).toFixed(2)}</p>
                  {c.iban && <p className="text-xs text-gray-500 mt-0.5 font-mono">{c.iban}</p>}
                  <p className="text-xs text-gray-400 mt-1">{fmt(c.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor[c.status] ?? "bg-gray-50 text-gray-600"}`}>
                    {c.status}
                  </span>
                  {c.status === "pending" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateClearingStatus(c.id, "approved")}
                        className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                      >
                        Approva
                      </button>
                      <button
                        onClick={() => updateClearingStatus(c.id, "paid")}
                        className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                      >
                        Pagata
                      </button>
                      <button
                        onClick={() => updateClearingStatus(c.id, "rejected")}
                        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        Rifiuta
                      </button>
                    </div>
                  )}
                  {c.status === "approved" && (
                    <button
                      onClick={() => updateClearingStatus(c.id, "paid")}
                      className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    >
                      Segna pagata
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {clearings.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Nessuna richiesta clearing.</p>}
        </div>
      )}
    </main>
  );
}
