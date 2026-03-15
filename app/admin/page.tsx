"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase-client";
import {
  getAdminPayments, getAdminClearings,
  updateClearingStatus as updateClearingStatusAction,
  adminCreditWallet, adminCreditEur, getAdminWallets,
  adminToggleSuspend, adminDeleteUser, getAdminUsersWithStatus,
} from "@/app/actions/admin";
import { getAdminTopupRequests, approveTopupRequest, rejectTopupRequest } from "@/app/actions/topup";
import { adminSendNotification } from "@/app/actions/notifications";
import { getPlatformSettings, updatePlatformSetting, getAdminMerchantFees, setMerchantFeeOverride } from "@/app/actions/settings";

type Tab = "users" | "payments" | "clearing" | "wallet" | "topup" | "settings" | "fee-merchant";

type UserRow = {
  user_id: string; role: string | null; full_name: string | null;
  business_name: string | null; city: string | null; sector: string | null;
  onboarding_completed: boolean | null; created_at: string; suspended: boolean | null;
  email: string; memberNumberFormatted: string;
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
type WalletRow = { profile_user_id: string; token_balance: number; eur_balance: number };
type TopupRow = {
  id: string; user_id: string; userName: string;
  package_eur: number; tokens: number; status: string; created_at: string;
};
type CreditType = "tokens" | "eur";

type MerchantFeeRow = {
  userId: string; name: string; city: string; sector: string;
  feeEur: number | null; feeToken: number | null;
  globalFeeEur: number; globalFeeToken: number;
};

const SECTOR_OPTIONS = [
  "Bar", "Ristorante", "Pizzeria", "Supermercato", "Abbigliamento",
  "Farmacia", "Parrucchiere", "Palestra", "Hotel", "Tabaccheria",
  "Panificio", "Pasticceria", "Altro",
];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [clearings, setClearings] = useState<ClearingRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Users tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkNotifTitle, setBulkNotifTitle] = useState("");
  const [bulkNotifBody, setBulkNotifBody] = useState("");
  const [bulkNotifOpen, setBulkNotifOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    action: "suspend" | "unsuspend" | "delete";
    userId: string; name: string;
  } | null>(null);

  // Wallet tab state
  const [walletTarget, setWalletTarget] = useState<{ userId: string; name: string; role: string } | null>(null);
  const [creditType, setCreditType] = useState<CreditType>("tokens");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletFilter, setWalletFilter] = useState("");

  // Admin notif state
  const [notifRole, setNotifRole] = useState("all");
  const [notifSector, setNotifSector] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifLoading, setNotifLoading] = useState(false);

  // Settings state
  const [feeEur, setFeeEur] = useState(5);
  const [feeToken, setFeeToken] = useState(3);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Fee merchant tab state
  const [merchantFeeRows, setMerchantFeeRows] = useState<MerchantFeeRow[]>([]);
  const [merchantFeeDrafts, setMerchantFeeDrafts] = useState<Record<string, { eur: string; token: string }>>({});
  const [merchantFeeSaving, setMerchantFeeSaving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { router.push("/"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", authData.user.id).single();
      if (profile?.role !== "admin") { router.push("/"); return; }
      try {
        const [u, p, c, w, t, s, mf] = await Promise.all([
          getAdminUsersWithStatus(), getAdminPayments(), getAdminClearings(),
          getAdminWallets(), getAdminTopupRequests(), getPlatformSettings(),
          getAdminMerchantFees(),
        ]);
        setUsers(u as UserRow[]); setPayments(p); setClearings(c); setWallets(w); setTopupRequests(t);
        setFeeEur(s.fee_eur_percent ?? 5);
        setFeeToken(s.fee_token_percent ?? 3);
        const rows = mf as MerchantFeeRow[];
        setMerchantFeeRows(rows);
        const drafts: Record<string, { eur: string; token: string }> = {};
        rows.forEach((m) => { drafts[m.userId] = { eur: m.feeEur != null ? String(m.feeEur) : "", token: m.feeToken != null ? String(m.feeToken) : "" }; });
        setMerchantFeeDrafts(drafts);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [router]);

  const showMsg = (type: "ok" | "err", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 5000);
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = (u.business_name ?? u.full_name ?? "").toLowerCase();
      const city = (u.city ?? "").toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || name.includes(q) || city.includes(q) || (u.role ?? "").includes(q);
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchSector = sectorFilter === "all" || (u.sector ?? "").toLowerCase() === sectorFilter.toLowerCase();
      return matchSearch && matchRole && matchSector;
    });
  }, [users, searchQuery, roleFilter, sectorFilter]);

  const toggleSelectUser = (id: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.user_id)));
    }
  };

  async function handleBulkNotif() {
    if (!bulkNotifTitle || !bulkNotifBody || selectedUsers.size === 0) return;
    setNotifLoading(true);
    let sent = 0;
    const targetIds = Array.from(selectedUsers);
    for (let i = 0; i < targetIds.length; i++) {
      await adminSendNotification({ title: bulkNotifTitle, body: bulkNotifBody, targetRole: undefined });
      sent++;
    }
    showMsg("ok", `✓ Notifica inviata a ${sent} utenti`);
    setBulkNotifOpen(false);
    setBulkNotifTitle("");
    setBulkNotifBody("");
    setSelectedUsers(new Set());
    setNotifLoading(false);
  }

  async function handleConfirmAction() {
    if (!confirmModal) return;
    const { action, userId, name } = confirmModal;
    setConfirmModal(null);
    if (action === "delete") {
      const res = await adminDeleteUser(userId);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.user_id !== userId));
        showMsg("ok", `✓ Utente ${name} eliminato`);
      } else {
        showMsg("err", "Errore eliminazione");
      }
    } else {
      const suspended = action === "suspend";
      const res = await adminToggleSuspend(userId, suspended);
      if (res.success) {
        setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, suspended } : u));
        showMsg("ok", `✓ Utente ${name} ${suspended ? "sospeso" : "riattivato"}`);
      } else {
        showMsg("err", "Errore aggiornamento");
      }
    }
  }

  async function handleSendNotif() {
    if (!notifTitle || !notifBody) return;
    setNotifLoading(true);
    const res = await adminSendNotification({
      title: notifTitle, body: notifBody,
      targetRole: notifRole === "all" ? undefined : notifRole,
      targetSector: notifSector || undefined,
    });
    if (res.success) {
      showMsg("ok", `✓ Notifica inviata a ${res.count} utenti`);
      setNotifTitle(""); setNotifBody(""); setNotifRole("all"); setNotifSector("");
    } else {
      showMsg("err", res.error ?? "Errore");
    }
    setNotifLoading(false);
  }

  async function handleSaveMerchantFee(merchantId: string) {
    setMerchantFeeSaving(merchantId);
    const d = merchantFeeDrafts[merchantId];
    const feeEurVal = d?.eur !== "" ? parseFloat(d.eur) : null;
    const feeTokenVal = d?.token !== "" ? parseFloat(d.token) : null;
    const res = await setMerchantFeeOverride(merchantId, feeEurVal, feeTokenVal);
    if (res.success) {
      setMerchantFeeRows((prev) => prev.map((m) => m.userId === merchantId ? { ...m, feeEur: feeEurVal, feeToken: feeTokenVal } : m));
      showMsg("ok", `✓ Fee aggiornate per ${merchantFeeRows.find(m => m.userId === merchantId)?.name}`);
    } else {
      showMsg("err", "Errore salvataggio fee");
    }
    setMerchantFeeSaving(null);
  }

  async function handleResetMerchantFee(merchantId: string) {
    setMerchantFeeSaving(merchantId);
    await setMerchantFeeOverride(merchantId, null, null);
    setMerchantFeeRows((prev) => prev.map((m) => m.userId === merchantId ? { ...m, feeEur: null, feeToken: null } : m));
    setMerchantFeeDrafts((prev) => ({ ...prev, [merchantId]: { eur: "", token: "" } }));
    showMsg("ok", "✓ Fee ripristinata al valore globale");
    setMerchantFeeSaving(null);
  }

  async function handleSaveSettings() {
    setSettingsLoading(true);
    await Promise.all([
      updatePlatformSetting("fee_eur_percent", feeEur),
      updatePlatformSetting("fee_token_percent", feeToken),
    ]);
    showMsg("ok", "✓ Fee aggiornate");
    setSettingsLoading(false);
  }


  const updateClearingStatus = async (id: string, status: string) => {
    const res = await updateClearingStatusAction(id, status);
    if (!res.success) { showMsg("err", "Errore: " + res.error); return; }
    setClearings((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    showMsg("ok", `Richiesta → ${status}`);
  };

  async function handleCreditWallet() {
    if (!walletTarget || !walletAmount || parseFloat(walletAmount) <= 0) return;
    setWalletLoading(true);
    if (creditType === "tokens") {
      const tokens = parseInt(walletAmount);
      const res = await adminCreditWallet(walletTarget.userId, tokens, walletReason);
      if (res.success) { showMsg("ok", `✓ +${tokens} token a ${walletTarget.name}`); }
      else { showMsg("err", res.error ?? "Errore"); }
    } else {
      const eur = parseFloat(walletAmount);
      const res = await adminCreditEur(walletTarget.userId, eur);
      if (res.success) { showMsg("ok", `✓ +€${eur.toFixed(2)} EUR a ${walletTarget.name}`); }
      else { showMsg("err", res.error ?? "Errore"); }
    }
    setWalletAmount(""); setWalletReason(""); setWalletTarget(null);
    const updated = await getAdminWallets();
    setWallets(updated);
    setWalletLoading(false);
  }

  const handleTopup = async (id: string, action: "approve" | "reject") => {
    const res = action === "approve" ? await approveTopupRequest(id) : await rejectTopupRequest(id);
    if (!res.success) { showMsg("err", res.error ?? "Errore"); return; }
    setTopupRequests((prev) => prev.map((t) => t.id === id ? { ...t, status: action === "approve" ? "approved" : "rejected" } : t));
    showMsg("ok", `Ricarica ${action === "approve" ? "approvata" : "rifiutata"}`);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700", approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700", paid: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
    };
    return map[s] ?? "bg-gray-100 text-gray-600";
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "users", label: "👥 Utenti" },
    { id: "payments", label: "💳 Pagamenti" },
    { id: "clearing", label: "🏦 Prelievi" },
    { id: "topup", label: "📥 Ricariche" },
    { id: "wallet", label: "💰 Wallet" },
    { id: "fee-merchant", label: "💸 Fee Merchant" },
    { id: "settings", label: "⚙️ Impostazioni" },
  ];

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-8"><p className="text-sm text-gray-500">Caricamento admin...</p></main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Pannello Admin</h1>

      {actionMsg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
          actionMsg.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>{actionMsg.text}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-6 bg-gray-100 p-1 rounded-xl">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB UTENTI ─────────────────────────── */}
      {tab === "users" && (
        <div className="space-y-4">
          {/* Filtri */}
          <div className="flex flex-wrap gap-2">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nome, città, ruolo..."
              className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">Tutti i ruoli</option>
              <option value="user">User</option>
              <option value="merchant">Merchant</option>
              <option value="admin">Admin</option>
            </select>
            <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">Tutti i settori</option>
              {SECTOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Selezione massiva */}
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-indigo-700">{selectedUsers.size} selezionati</span>
              <button onClick={() => setBulkNotifOpen(true)}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
                📣 Invia notifica
              </button>
              <button onClick={() => setSelectedUsers(new Set())}
                className="text-xs text-indigo-400 hover:text-indigo-600">Deseleziona tutto</button>
            </div>
          )}

          {/* Modal notifica bulk */}
          {bulkNotifOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Invia notifica a {selectedUsers.size} utenti</h3>
                <input value={bulkNotifTitle} onChange={(e) => setBulkNotifTitle(e.target.value)}
                  placeholder="Titolo notifica"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <textarea value={bulkNotifBody} onChange={(e) => setBulkNotifBody(e.target.value)}
                  placeholder="Testo della notifica..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="flex gap-3">
                  <button onClick={handleBulkNotif} disabled={notifLoading}
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {notifLoading ? "Invio..." : "Invia"}
                  </button>
                  <button onClick={() => setBulkNotifOpen(false)}
                    className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal conferma azione */}
          {confirmModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
                <div className="text-3xl text-center mb-3">{confirmModal.action === "delete" ? "🗑️" : confirmModal.action === "suspend" ? "🚫" : "✅"}</div>
                <h3 className="text-lg font-semibold text-center mb-2">
                  {confirmModal.action === "delete" ? "Elimina utente" : confirmModal.action === "suspend" ? "Sospendi utente" : "Riattiva utente"}
                </h3>
                <p className="text-sm text-gray-500 text-center mb-1">
                  {confirmModal.action === "delete"
                    ? "Questa azione è irreversibile. Verranno eliminati profilo, wallet e transazioni."
                    : `Confermi di voler ${confirmModal.action === "suspend" ? "sospendere" : "riattivare"} l'utente?`}
                </p>
                <p className="text-sm font-semibold text-center text-gray-800 mb-5">{confirmModal.name}</p>
                <div className="flex gap-3">
                  <button onClick={handleConfirmAction}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white ${
                      confirmModal.action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                    }`}>
                    Conferma
                  </button>
                  <button onClick={() => setConfirmModal(null)}
                    className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabella utenti */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left">
                    <input type="checkbox"
                      checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded" />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-700 hidden sm:table-cell">#</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-700">Nome</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-700 hidden lg:table-cell">Email</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-700">Ruolo</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-700 hidden md:table-cell">Settore</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-700">Stato</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-700">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className={`hover:bg-gray-50 ${u.suspended ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selectedUsers.has(u.user_id)} onChange={() => toggleSelectUser(u.user_id)} className="rounded" />
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <span className="text-xs font-mono text-indigo-600 font-bold">{u.memberNumberFormatted}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/utenti/${u.user_id}`} target="_blank"
                        className="font-medium text-gray-800 hover:text-indigo-600 hover:underline text-sm">
                        {u.business_name ?? u.full_name ?? <span className="text-gray-400 italic">N/D</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-gray-500 max-w-32 truncate">{u.email || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === "admin" ? "bg-purple-100 text-purple-700" :
                        u.role === "merchant" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{u.role ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 hidden md:table-cell text-xs">{u.sector ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {u.suspended
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Sospeso</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Attivo</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setConfirmModal({ action: u.suspended ? "unsuspend" : "suspend", userId: u.user_id, name: u.business_name ?? u.full_name ?? u.user_id })}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600"
                          title={u.suspended ? "Riattiva" : "Sospendi"}>
                          {u.suspended ? "✅" : "🚫"}
                        </button>
                        <button
                          onClick={() => setConfirmModal({ action: "delete", userId: u.user_id, name: u.business_name ?? u.full_name ?? u.user_id })}
                          className="text-xs px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                          title="Elimina">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Nessun utente trovato</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">{filteredUsers.length} di {users.length} utenti</p>
        </div>
      )}

      {/* ── TAB PAGAMENTI ──────────────────────── */}
      {tab === "payments" && (
        <div className="space-y-2">
          {payments.length === 0 && <p className="text-sm text-gray-500">Nessun pagamento.</p>}
          {payments.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-800">€{Number(p.amount_eur).toFixed(2)} · {p.cashback_percent}% cashback</p>
                  <p className="text-xs text-gray-500 mt-0.5">+{p.cashback_tokens} token al cliente · fee €{Number(p.fee_eur).toFixed(2)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(p.created_at).toLocaleDateString("it-IT")}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(p.status)}`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB PRELIEVI ───────────────────────── */}
      {tab === "clearing" && (
        <div className="space-y-2">
          {clearings.length === 0 && <p className="text-sm text-gray-500">Nessuna richiesta.</p>}
          {clearings.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">€{Number(c.eur_amount).toFixed(2)} · {c.token_amount} token</p>
                  {c.iban && <p className="text-xs text-gray-500 mt-0.5 font-mono">{c.iban}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(c.created_at).toLocaleDateString("it-IT")}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(c.status)}`}>{c.status}</span>
                  {c.status === "pending" && (
                    <>
                      <button onClick={() => updateClearingStatus(c.id, "approved")}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200">Approva</button>
                      <button onClick={() => updateClearingStatus(c.id, "paid")}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200">Pagata</button>
                      <button onClick={() => updateClearingStatus(c.id, "rejected")}
                        className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200">Rifiuta</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB RICARICHE ──────────────────────── */}
      {tab === "topup" && (
        <div className="space-y-2">
          {topupRequests.length === 0 && <p className="text-sm text-gray-500">Nessuna ricarica.</p>}
          {topupRequests.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.userName} · €{Number(t.package_eur).toFixed(0)} → {t.tokens} token</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString("it-IT")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(t.status)}`}>{t.status}</span>
                  {t.status === "pending" && (
                    <>
                      <button onClick={() => handleTopup(t.id, "approve")}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200">Approva</button>
                      <button onClick={() => handleTopup(t.id, "reject")}
                        className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200">Rifiuta</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB WALLET ─────────────────────────── */}
      {tab === "wallet" && (
        <div className="space-y-4">
          <div>
            <input value={walletFilter} onChange={(e) => setWalletFilter(e.target.value)}
              placeholder="Cerca utente..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3" />
            <div className="space-y-1">
              {users
                .filter((u) => !walletFilter || (u.full_name ?? u.business_name ?? "").toLowerCase().includes(walletFilter.toLowerCase()))
                .map((u) => {
                  const w = wallets.find((ww) => ww.profile_user_id === u.user_id);
                  return (
                    <div key={u.user_id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{u.business_name ?? u.full_name ?? "—"}</p>
                        <p className="text-xs text-gray-500">{u.role} · {u.memberNumberFormatted}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs">
                          {w ? (
                            <>
                              <p className="font-semibold text-indigo-700">{Number(w.token_balance).toLocaleString()} tok</p>
                              <p className="text-gray-500">€{Number(w.eur_balance).toFixed(2)}</p>
                            </>
                          ) : (
                            <p className="text-gray-400 italic">No wallet</p>
                          )}
                        </div>
                        <button onClick={() => { setWalletTarget({ userId: u.user_id, name: u.business_name ?? u.full_name ?? "—", role: u.role ?? "" }); setCreditType("tokens"); setWalletAmount(""); setWalletReason(""); }}
                          className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-100">
                          Carica
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {walletTarget && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
                <h3 className="text-lg font-semibold mb-1">Carica wallet</h3>
                <p className="text-sm text-gray-500 mb-4">{walletTarget.name}</p>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setCreditType("tokens")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${creditType === "tokens" ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    Token
                  </button>
                  <button onClick={() => setCreditType("eur")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${creditType === "eur" ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    EUR
                  </button>
                </div>
                <input type="number" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)}
                  placeholder={creditType === "tokens" ? "Numero token" : "Importo €"}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="text" value={walletReason} onChange={(e) => setWalletReason(e.target.value)}
                  placeholder="Causale (opzionale)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="flex gap-3">
                  <button onClick={handleCreditWallet} disabled={walletLoading}
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {walletLoading ? "..." : "Conferma"}
                  </button>
                  <button onClick={() => setWalletTarget(null)}
                    className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ── TAB FEE MERCHANT ──────────────────── */}
      {tab === "fee-merchant" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            Fee globale attuale: <strong>{feeEur}% EUR</strong> · <strong>{feeToken}% Token</strong>.
            Lascia vuoto per usare quella globale — compila per sovrascrivere solo per quel merchant.
          </div>

          {merchantFeeRows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nessun merchant registrato.</p>
          ) : (
            <div className="space-y-3">
              {merchantFeeRows.map((m) => {
                const draft = merchantFeeDrafts[m.userId] ?? { eur: "", token: "" };
                const hasOverride = m.feeEur != null || m.feeToken != null;
                const savedEur = m.feeEur != null ? String(m.feeEur) : "";
                const savedToken = m.feeToken != null ? String(m.feeToken) : "";
                const isDirty = draft.eur !== savedEur || draft.token !== savedToken;

                return (
                  <div key={m.userId} className={`rounded-xl border px-4 py-4 bg-white ${hasOverride ? "border-indigo-200" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Nome — link che apre scheda dettaglio */}
                      <div className="min-w-0">
                        <Link href={`/admin/utenti/${m.userId}`} target="_blank"
                          className="text-sm font-semibold text-indigo-700 hover:underline">
                          {m.name} ↗
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">{[m.sector, m.city].filter(Boolean).join(" · ")}</p>
                        {hasOverride && (
                          <span className="inline-block mt-1.5 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                            Fee personalizzata
                          </span>
                        )}
                      </div>

                      {/* Input fee */}
                      <div className="flex items-end gap-3 flex-wrap">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Fee EUR %</label>
                          <input
                            type="number" min="0" max="20" step="0.5"
                            value={draft.eur}
                            onChange={(e) => setMerchantFeeDrafts(prev => ({ ...prev, [m.userId]: { ...prev[m.userId], eur: e.target.value } }))}
                            placeholder={`${m.globalFeeEur}%`}
                            className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Fee Token %</label>
                          <input
                            type="number" min="0" max="20" step="0.5"
                            value={draft.token}
                            onChange={(e) => setMerchantFeeDrafts(prev => ({ ...prev, [m.userId]: { ...prev[m.userId], token: e.target.value } }))}
                            placeholder={`${m.globalFeeToken}%`}
                            className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveMerchantFee(m.userId)}
                            disabled={!isDirty || merchantFeeSaving === m.userId}
                            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                          >
                            {merchantFeeSaving === m.userId ? "..." : "Salva"}
                          </button>
                          {hasOverride && (
                            <button
                              onClick={() => handleResetMerchantFee(m.userId)}
                              disabled={merchantFeeSaving === m.userId}
                              className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB IMPOSTAZIONI ───────────────────── */}
      {tab === "settings" && (
        <div className="space-y-6 max-w-lg">
          {/* Fee */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">💸 Fee di piattaforma</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fee su pagamenti EUR (POS/Stripe)
                </label>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={20} step={0.5} value={feeEur} onChange={(e) => setFeeEur(parseFloat(e.target.value))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-500">% trattenuta dal merchant</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fee su pagamenti Token (QR)
                </label>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={20} step={0.5} value={feeToken} onChange={(e) => setFeeToken(parseFloat(e.target.value))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-500">% nascosta (carico cliente)</span>
                </div>
              </div>
            </div>
            <button onClick={handleSaveSettings} disabled={settingsLoading}
              className="mt-5 w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {settingsLoading ? "Salvataggio..." : "Salva fee"}
            </button>
          </div>

          {/* Notifiche admin */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">📣 Invia comunicazione</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <select value={notifRole} onChange={(e) => setNotifRole(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="all">Tutti gli utenti</option>
                  <option value="user">Solo User</option>
                  <option value="merchant">Solo Merchant</option>
                </select>
                <select value={notifSector} onChange={(e) => setNotifSector(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Tutti i settori</option>
                  {SECTOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Titolo notifica"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <textarea value={notifBody} onChange={(e) => setNotifBody(e.target.value)}
                placeholder="Testo del messaggio..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={handleSendNotif} disabled={notifLoading || !notifTitle || !notifBody}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {notifLoading ? "Invio..." : "Invia notifica"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
