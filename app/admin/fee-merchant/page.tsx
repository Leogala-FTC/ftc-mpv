"use client";

import { useEffect, useState } from "react";
import { getAdminMerchantFees, setMerchantFeeOverride } from "@/app/actions/settings";
import { useRouter } from "next/navigation";

type MerchantFeeRow = {
  userId: string; name: string; city: string; sector: string;
  feeEur: number | null; feeToken: number | null;
  globalFeeEur: number; globalFeeToken: number;
};

export default function AdminMerchantFeesPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<MerchantFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // Stato draft delle fee per ogni merchant
  const [drafts, setDrafts] = useState<Record<string, { eur: string; token: string }>>({});

  useEffect(() => {
    getAdminMerchantFees().then((data) => {
      setMerchants(data as MerchantFeeRow[]);
      // Inizializza i draft con i valori esistenti
      const d: Record<string, { eur: string; token: string }> = {};
      (data as MerchantFeeRow[]).forEach((m) => {
        d[m.userId] = {
          eur: m.feeEur != null ? String(m.feeEur) : "",
          token: m.feeToken != null ? String(m.feeToken) : "",
        };
      });
      setDrafts(d);
      setLoading(false);
    });
  }, []);

  function showMsg(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  async function handleSave(merchantId: string) {
    setSaving(merchantId);
    const d = drafts[merchantId];
    const feeEur = d?.eur !== "" ? parseFloat(d.eur) : null;
    const feeToken = d?.token !== "" ? parseFloat(d.token) : null;

    const res = await setMerchantFeeOverride(merchantId, feeEur, feeToken);
    if (res.success) {
      setMerchants((prev) => prev.map((m) => m.userId === merchantId ? { ...m, feeEur, feeToken } : m));
      showMsg("ok", `✓ Fee aggiornate per ${merchants.find(m => m.userId === merchantId)?.name}`);
    } else {
      showMsg("err", "Errore salvataggio");
    }
    setSaving(null);
  }

  async function handleReset(merchantId: string) {
    setSaving(merchantId);
    await setMerchantFeeOverride(merchantId, null, null);
    setMerchants((prev) => prev.map((m) => m.userId === merchantId ? { ...m, feeEur: null, feeToken: null } : m));
    setDrafts((prev) => ({ ...prev, [merchantId]: { eur: "", token: "" } }));
    showMsg("ok", "✓ Override rimosso — usa fee globale");
    setSaving(null);
  }

  const global = merchants[0] ? { eur: merchants[0].globalFeeEur, token: merchants[0].globalFeeToken } : { eur: 5, token: 3 };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600">← Admin</button>
        <div>
          <h1 className="text-2xl font-semibold">Fee per merchant</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Fee globale: <strong>{global.eur}% EUR</strong> · <strong>{global.token}% Token</strong>.
            {" "}Lascia vuoto per usarla. Compila per sovrascriverla.
          </p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
          msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>{msg.text}</div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl"/>)}</div>
      ) : merchants.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nessun merchant registrato.</p>
      ) : (
        <div className="space-y-3">
          {merchants.map((m) => {
            const draft = drafts[m.userId] ?? { eur: "", token: "" };
            const hasOverride = m.feeEur != null || m.feeToken != null;
            const isDirty =
              draft.eur !== (m.feeEur != null ? String(m.feeEur) : "") ||
              draft.token !== (m.feeToken != null ? String(m.feeToken) : "");

            return (
              <div key={m.userId} className={`rounded-xl border px-4 py-4 bg-white ${hasOverride ? "border-indigo-200" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Info merchant */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-400">{[m.sector, m.city].filter(Boolean).join(" · ")}</p>
                    {hasOverride && (
                      <span className="inline-block mt-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        Fee personalizzata
                      </span>
                    )}
                  </div>

                  {/* Input fee */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fee EUR %</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max="20" step="0.5"
                          value={draft.eur}
                          onChange={(e) => setDrafts(prev => ({ ...prev, [m.userId]: { ...prev[m.userId], eur: e.target.value } }))}
                          placeholder={`${m.globalFeeEur}% (globale)`}
                          className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fee Token %</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max="20" step="0.5"
                          value={draft.token}
                          onChange={(e) => setDrafts(prev => ({ ...prev, [m.userId]: { ...prev[m.userId], token: e.target.value } }))}
                          placeholder={`${m.globalFeeToken}% (globale)`}
                          className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleSave(m.userId)}
                        disabled={!isDirty || saving === m.userId}
                        className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                      >
                        {saving === m.userId ? "..." : "Salva"}
                      </button>
                      {hasOverride && (
                        <button
                          onClick={() => handleReset(m.userId)}
                          disabled={saving === m.userId}
                          className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                        >
                          Reset globale
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
    </main>
  );
}
