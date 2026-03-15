"use client";

import { useEffect, useState, useCallback } from "react";
import { getMerchantCashback, setMerchantCashback } from "@/app/actions/settings";

function useCountdown(targetISO: string | null) {
  const [remaining, setRemaining] = useState("");

  const calc = useCallback(() => {
    if (!targetISO) return;
    const diff = new Date(targetISO).getTime() - Date.now();
    if (diff <= 0) { setRemaining("Disponibile ora"); return; }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const parts = [];
    if (days > 0) parts.push(`${days}g`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    setRemaining(parts.join(" "));
  }, [targetISO]);

  useEffect(() => {
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [calc]);

  return remaining;
}

export default function MerchantCashbackPage() {
  const [current, setCurrent] = useState(3);
  const [value, setValue] = useState(3);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadySet, setAlreadySet] = useState(false);
  const [nextUpdateAt, setNextUpdateAt] = useState<string | null>(null);
  const [lastSetAt, setLastSetAt] = useState<string | null>(null);

  const countdown = useCountdown(alreadySet ? nextUpdateAt : null);

  useEffect(() => {
    getMerchantCashback().then((data) => {
      setCurrent(data.percent);
      setValue(data.percent);
      setAlreadySet(data.alreadySetThisWeek);
      setNextUpdateAt(data.nextUpdateAt);
      setLastSetAt(data.lastSetAt ?? null);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const res = await setMerchantCashback(value);
    if (res.success) {
      setCurrent(value);
      setAlreadySet(true);
      setMsg({ type: "ok", text: `✓ Cashback impostato al ${value}% per questa settimana` });
    } else {
      setMsg({ type: "err", text: res.error ?? "Errore" });
      // Ricarica stato reale
      const fresh = await getMerchantCashback();
      setAlreadySet(fresh.alreadySetThisWeek);
    }
    setSaving(false);
  }

  const exampleTokens = Math.floor(100 * 11.7 * (value / 100));

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-1">Cashback ai clienti</h1>
      <p className="text-sm text-gray-500 mb-6">
        Imposta la % cashback settimanale per i tuoi clienti. Puoi aggiornarla una volta a settimana, ogni lunedì.
      </p>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl"/>)}</div>
      ) : (
        <>
          {/* Saldo corrente */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 mb-4">
            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide mb-1">Cashback attuale</p>
            <p className="text-3xl font-bold text-indigo-700">{current}%</p>
            <p className="text-xs text-indigo-400 mt-1">
              Su ogni €100 → cliente riceve {Math.floor(100 * 11.7 * (current / 100)).toLocaleString()} token
            </p>
            {lastSetAt && (
              <p className="text-xs text-indigo-300 mt-0.5">
                Impostato il {new Date(lastSetAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          {/* Countdown se già impostato questa settimana */}
          {alreadySet && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-4 flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Già impostato questa settimana</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Prossima modifica disponibile tra: <strong>{countdown}</strong>
                </p>
                <p className="text-xs text-amber-500 mt-0.5">
                  Dal lunedì puoi impostare il cashback per la settimana successiva.
                </p>
              </div>
            </div>
          )}

          {/* Slider — disabilitato se già impostato */}
          <div className={`bg-white border border-gray-200 rounded-xl px-5 py-5 mb-4 ${alreadySet ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Nuova percentuale</label>
              <span className="text-2xl font-bold text-indigo-600">{value}%</span>
            </div>

            <input
              type="range" min={1} max={20} step={0.5} value={value}
              onChange={(e) => setValue(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 mb-3"
              disabled={alreadySet}
            />

            <div className="flex justify-between text-xs text-gray-400 mb-4">
              <span>Min 1%</span><span>Max 20%</span>
            </div>

            {/* Preset */}
            <div className="flex gap-2 flex-wrap mb-4">
              {[3, 5, 8, 10, 15, 20].map((p) => (
                <button key={p} onClick={() => setValue(p)} disabled={alreadySet}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    value === p ? "bg-indigo-600 text-white border-indigo-600" : "text-gray-600 border-gray-300 hover:border-indigo-300"
                  }`}>{p}%</button>
              ))}
            </div>

            {/* Anteprima */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-xs text-gray-500 font-medium mb-1">📊 Su €100 di acquisto</p>
              <div className="flex justify-between">
                <span className="text-gray-600">Cashback cliente</span>
                <span className="font-semibold text-green-700">+{exampleTokens.toLocaleString()} token</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-600">Pari a</span>
                <span className="text-gray-500">≈ €{(exampleTokens / 11.7).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {msg && (
            <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${
              msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
            }`}>{msg.text}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || alreadySet || value === current}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Salvataggio..." :
             alreadySet ? `🔒 Modifica disponibile tra ${countdown}` :
             value === current ? "Nessuna modifica" :
             `Imposta cashback al ${value}%`}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Una modifica a settimana. Il cashback è valido per tutti i pagamenti dal momento dell&apos;impostazione.
          </p>
        </>
      )}
    </main>
  );
}
