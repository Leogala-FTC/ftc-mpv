"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";
import {
  getAdminUsers, getAdminPayments, getAdminClearings,
  updateClearingStatus as updateClearingStatusAction,
  adminCreditWallet,
} from "@/app/actions/admin";

type Tab = "users" | "payments" | "clearing" | "wallet";

type UserRow = {
  user_id: string; role: string | null; full_name: string | null;
  business_name: string | null; city: string | null;
  onboarding_completed: boolean | null; created_at: string;
};
type PaymentRow = {
  id: string; amount_eur: number; fee_eur: number; cashback_tokens: number;
  cashback_percent: number; status: string; created_at: string;
  merchant_user_id: string; buyer_user_id: string;
};
type ClearingRow = {
  id: string; token_amount: number; eur_amount: number; status: string;
  iban: string | null; created_at: string; merchant_user_id: string;
};

const TOKENS_PER_EURO = 11.7;

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [clearings, setClearings] = useState<ClearingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [adminUserId, setAdminUserId] = useState("");

  // Wallet carica manuale
  const [walletTarget, setWalletTarget] = useState<{ userId: string; name: string } | null>(null);
  const [walletTokens, setWalletTokens] = useState("");
  const [walletReason, setWalletReason] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletFilter, setWalletFilter] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/"); return; }
      setAdminUserId(authData.user.id);

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("user_id", authData.user.id).single();
      if (profile?.role !== "admin") { router.push("/"); return; }

      try {
        const [u, p, c] = await Promise.all([getAdminUsers(), getAdminPayments(), getAdminClearings()]);
        setUsers(u); setPayments(p); setClearings(c);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [router]);

  const showMsg = (type: "ok" | "err", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const updateClearingStatus = async (id: string, status: string) => {
    const res = await updateClearingStatusAction(id, status);
    if (!res.success) { showMsg("err", "Errore: " + res.error); return; }
    setClearings((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    showMsg("ok", `Richiesta aggiornata → ${status}`);
  };

  async function handleCreditWallet() {
    if (!walletTarget || !walletTokens || parseInt(walletTokens) <= 0) return;
    setWalletLoading(true);
    const res = await adminCreditWallet(
      walletTarget.userId,
      parseInt(walletTokens),
      walletReason || "",
      adminUserId
    );
    if (res.success) {
      showMsg("ok", `✓ Caricati ${res.tokenAmount} token su ${walletTarget.name} (≈€${res.eurEquiv?.toFixed(2)})`);
      setWalletTarget(null);
      setWalletTokens("");
      setWalletReason("");
    } else {
      showMsg("err", "Errore: " + res.error);
    }
    setWalletLoading(false);
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  const shortId = (id: string) => id.slice(0, 8) + "…";

  const statusColor: Record<string, string> = {
    pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
    approved: "text-green-700 bg-green-50 border-green-200",
    rejected: "text-red-700 bg-red-50 border-red-200",
    paid: "text-indigo-700 bg-indigo-50 border-indigo-200",
    completed: "text-green-700 bg-green-50 border-green-200",
  };

  const filteredUsers = users.filter((u) => {
    const q = walletFilter.toLowerCase();
    return !q ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.business_name ?? "").toLowerCase().includes(q) ||
      (u.city ?? "").toLowerCase().includes(q) ||
      u.role?.includes(q);
  });

  if (loading) return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm text-gray-500">Caricamento...</p>
    </main>
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-1">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        {users.length} utenti · {payments.length} pagamenti · {clearings.filter(c => c.status === "pending").length} clearing in attesa
      </p>

      {actionMsg && (
        <div className={`mb-4 rounded-lg border px-4 py-2 text-sm ${
          actionMsg.type === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {actionMsg.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {(["users", "payments", "clearing", "wallet"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "users" ? "Utenti" : t === "payments" ? "Pagamenti" : t === "clearing" ? "Clearing" : "💳 Carica Wallet"}
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
                <th className="pb-2 pr-4 font-medium">Merchant (90%)</th>
                <th className="pb-2 pr-4 font-medium">FTC (5%)</th>
                <th className="pb-2 pr-4 font-medium">Cashback</th>
                <th className="pb-2 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const merchantEur = p.amount_eur - p.fee_eur - (p.amount_eur * (p.cashback_percent / 100));
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-500 text-xs">{fmt(p.created_at)}</td>
                    <td className="py-2 pr-4 font-semibold">€{Number(p.amount_eur).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-green-700">€{merchantEur.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-gray-600">€{Number(p.fee_eur).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-indigo-600">{p.cashback_tokens} token ({p.cashback_percent}%)</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusColor[p.status] ?? "bg-gray-50 text-gray-600"}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-400 text-sm">Nessun pagamento.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* CLEARING */}
      {tab === "clearing" && (
        <div className="space-y-3">
          {clearings.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-100 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{c.token_amount.toLocaleString()} token → €{Number(c.eur_amount).toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">merchant: {shortId(c.merchant_user_id)}</p>
                  {c.iban && <p className="text-xs text-gray-500 mt-0.5 font-mono">{c.iban}</p>}
                  <p className="text-xs text-gray-400 mt-1">{fmt(c.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border whitespace-nowrap ${statusColor[c.status] ?? "bg-gray-50 text-gray-600"}`}>
                    {c.status}
                  </span>
                  {c.status === "pending" && (
                    <div className="flex gap-1">
                      <button onClick={() => updateClearingStatus(c.id, "approved")} className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200">Approva</button>
                      <button onClick={() => updateClearingStatus(c.id, "paid")} className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200">Pagata</button>
                      <button onClick={() => updateClearingStatus(c.id, "rejected")} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">Rifiuta</button>
                    </div>
                  )}
                  {c.status === "approved" && (
                    <button onClick={() => updateClearingStatus(c.id, "paid")} className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200">Segna pagata</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {clearings.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Nessuna richiesta clearing.</p>}
        </div>
      )}

      {/* CARICA WALLET */}
      {tab === "wallet" && (
        <div className="max-w-lg">
          <p className="text-sm text-gray-600 mb-6">
            Strumento MVP per caricare token manualmente su qualsiasi wallet (utente o merchant), in sostituzione del pagamento Stripe.
          </p>

          {/* Seleziona destinatario */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">1. Seleziona destinatario</label>
            <input
              type="text"
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              placeholder="Filtra per nome, ruolo o città…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                const name = u.full_name ?? u.business_name ?? "—";
                const isSelected = walletTarget?.userId === u.user_id;
                return (
                  <button
                    key={u.user_id}
                    onClick={() => setWalletTarget({ userId: u.user_id, name })}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
                    }`}
                  >
                    <span className={`font-medium ${isSelected ? "text-indigo-700" : ""}`}>{name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === "merchant" ? "bg-blue-50 text-blue-600" :
                      u.role === "admin" ? "bg-purple-50 text-purple-600" : "bg-gray-100 text-gray-500"
                    }`}>{u.role}</span>
                  </button>
                );
              })}
              {filteredUsers.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nessun utente trovato</p>}
            </div>
          </div>

          {/* Importo */}
          {walletTarget && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-indigo-800">Destinatario: {walletTarget.name}</p>
                <button onClick={() => setWalletTarget(null)} className="text-xs text-gray-400 hover:text-red-500">✕</button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token da caricare</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={walletTokens}
                  onChange={(e) => setWalletTokens(e.target.value)}
                  placeholder="es. 1170 = €100"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {parseInt(walletTokens) > 0 && (
                  <p className="text-xs text-indigo-600 mt-1">
                    ≈ €{(parseInt(walletTokens) / TOKENS_PER_EURO).toFixed(2)} in valore token
                  </p>
                )}
              </div>

              {/* Scorciatoie comuni */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Importi rapidi:</p>
                <div className="flex gap-2 flex-wrap">
                  {[10, 50, 100, 200, 500].map((eur) => (
                    <button
                      key={eur}
                      onClick={() => setWalletTokens(String(Math.floor(eur * TOKENS_PER_EURO)))}
                      className="text-xs px-3 py-1 rounded-full border border-indigo-300 text-indigo-600 hover:bg-indigo-100"
                    >
                      €{eur}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Causale (opzionale)</label>
                <input
                  type="text"
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  placeholder="es. Test MVP, Promozione lancio…"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={handleCreditWallet}
                disabled={walletLoading || !walletTokens || parseInt(walletTokens) <= 0}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {walletLoading ? "Caricamento..." : `✓ Carica ${walletTokens ? parseInt(walletTokens).toLocaleString() : "0"} token`}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
