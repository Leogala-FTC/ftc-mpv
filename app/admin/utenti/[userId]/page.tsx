"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAdminUserDetail } from "@/app/actions/admin";

const TOKENS_PER_EURO = 11.7;

type Transaction = { id: string; direction: string; amount_tokens: number; reason: string | null; created_at: string };

type UserDetail = {
  profile: {
    user_id: string; email: string; memberNumberFormatted: string;
    full_name: string | null; business_name: string | null; alias: string | null;
    role: string | null; city: string | null; sector: string | null;
    address: string | null; cf: string | null; vat_number: string | null;
    ateco: string | null; pec: string | null; iban: string | null;
    onboarding_completed: boolean | null; suspended: boolean | null;
    created_at: string; member_number: number | null;
  } | null;
  wallet: { token_balance: number; eur_balance: number };
  transactions: Transaction[];
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome completo", business_name: "Ragione sociale", alias: "Alias",
  email: "Email", memberNumberFormatted: "Codice FTC", role: "Ruolo",
  city: "Città", sector: "Settore", address: "Indirizzo",
  cf: "Codice fiscale", vat_number: "Partita IVA", ateco: "ATECO",
  pec: "PEC", iban: "IBAN", created_at: "Iscritto il",
};

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminUserDetail(userId).then((res) => {
      setData(res as UserDetail);
      setLoading(false);
    }).catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl"/>)}</div>
    </main>
  );

  if (error || !data?.profile) return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-center">
      <p className="text-red-600">{error || "Utente non trovato"}</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-indigo-600 underline">← Indietro</button>
    </main>
  );

  const { profile, wallet, transactions } = data;
  const displayName = profile.business_name ?? profile.full_name ?? "Senza nome";
  const isMerchant = profile.role === "merchant";

  const profileFields = isMerchant
    ? ["memberNumberFormatted", "email", "role", "business_name", "vat_number", "cf", "ateco", "pec", "address", "city", "sector", "iban", "created_at"]
    : ["memberNumberFormatted", "email", "role", "full_name", "alias", "cf", "address", "city", "created_at"];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
            ← Pannello Admin
          </button>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-0.5 font-mono">{profile.memberNumberFormatted}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            profile.role === "admin" ? "bg-purple-100 text-purple-700" :
            isMerchant ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
          }`}>{profile.role}</span>
          {profile.suspended && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Sospeso</span>
          )}
          {!profile.onboarding_completed && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Onboarding incompleto</span>
          )}
        </div>
      </div>

      {/* Saldo wallet */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide mb-1">Token</p>
          <p className="text-2xl font-bold text-indigo-700">{wallet.token_balance.toLocaleString("it-IT")}</p>
          <p className="text-xs text-indigo-400 mt-0.5">≈ €{(wallet.token_balance / TOKENS_PER_EURO).toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">EUR</p>
          <p className="text-2xl font-bold text-gray-700">€{Number(wallet.eur_balance).toFixed(2)}</p>
          {isMerchant && <p className="text-xs text-gray-400 mt-0.5">Da prelevare</p>}
        </div>
      </div>

      {/* Dati profilo */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Dati profilo</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {profileFields.map((field) => {
            const rawVal = (profile as Record<string, unknown>)[field];
            if (rawVal == null || rawVal === "") return null;
            const label = FIELD_LABELS[field] ?? field;
            let displayVal = String(rawVal);
            if (field === "created_at") {
              displayVal = new Date(rawVal as string).toLocaleDateString("it-IT", {
                day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
              });
            }
            return (
              <div key={field} className="flex items-start justify-between px-4 py-3 gap-4">
                <span className="text-sm text-gray-500 flex-shrink-0 w-36">{label}</span>
                <span className={`text-sm font-medium text-gray-800 text-right break-all ${
                  field === "memberNumberFormatted" ? "font-mono text-indigo-700 font-bold" : ""
                }`}>{displayVal}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ultime transazioni */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Ultime transazioni ({transactions.length})</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Nessuna transazione</p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 gap-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{tx.reason ?? (tx.direction === "in" ? "Accredito" : "Addebito")}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${tx.direction === "in" ? "text-green-600" : "text-red-500"}`}>
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
