"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createTokenPaymentSession, checkSessionStatus } from "@/app/actions/token-payment";
import { TOKENS_PER_EURO } from "@/lib/stripe";

export default function RequestPaymentPage() {
  const [amountEur, setAmountEur] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{
    sessionId: string; tokenAmount: number; feeTokens: number; totalTokens: number; expiresAt: Date;
  } | null>(null);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 min in secondi
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const amount = parseFloat(amountEur) || 0;
  const tokenAmount = Math.floor(amount * TOKENS_PER_EURO);

  // Polling: controlla ogni 3 secondi se il cliente ha pagato
  const startPolling = useCallback((sessionId: string) => {
    pollingRef.current = setInterval(async () => {
      const res = await checkSessionStatus(sessionId);
      if (res.status === "completed") {
        setPaid(true);
        clearInterval(pollingRef.current!);
        clearInterval(countdownRef.current!);
      } else if (res.status === "expired") {
        clearInterval(pollingRef.current!);
        clearInterval(countdownRef.current!);
        setSession(null);
        setError("Sessione scaduta. Genera un nuovo QR.");
      }
    }, 3000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!session) return;
    const secs = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    setCountdown(secs);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownRef.current!);
  }, [session]);

  async function handleCreate() {
    if (amount <= 0) return;
    setLoading(true);
    setError("");
    const res = await createTokenPaymentSession(amount, note || undefined);
    if (res.success && "sessionId" in res) {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      setSession({
        sessionId: res.sessionId,
        tokenAmount: res.tokenAmount ?? 0,
        feeTokens: res.feeTokens ?? 0,
        totalTokens: res.totalTokens ?? 0,
        expiresAt,
      });
      startPolling(res.sessionId);
    } else {
      setError(res.error ?? "Errore");
    }
    setLoading(false);
  }

  function handleReset() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setSession(null);
    setAmountEur("");
    setNote("");
    setPaid(false);
    setError("");
  }

  const payUrl = session
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${session.sessionId}`
    : "";
  const qrUrl = payUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payUrl)}&size=240x240`
    : "";

  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = countdown % 60;
  const countdownStr = `${countdownMin}:${String(countdownSec).padStart(2, "0")}`;
  const countdownUrgent = countdown < 120;

  // Pagamento ricevuto
  if (paid && session) return (
    <main className="mx-auto max-w-sm px-4 py-12 text-center">
      <div className="text-6xl mb-4">✅</div>
      <h1 className="text-2xl font-bold text-green-700 mb-2">Pagamento ricevuto!</h1>
      <p className="text-sm text-gray-600 mb-1">
        Hai incassato <strong>{session.tokenAmount.toLocaleString()} token</strong>
      </p>
      <p className="text-sm text-gray-500 mb-1">
        pari a €{amount.toFixed(2)}
      </p>
      <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
        I token sono stati accreditati sul tuo wallet.
      </div>
      <button
        onClick={handleReset}
        className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700"
      >
        Nuovo pagamento
      </button>
    </main>
  );

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Incassa in Token</h1>
      <p className="text-sm text-gray-500 mb-6">
        Genera un QR: il cliente lo scansiona e paga con i suoi token FTC.
      </p>

      {!session ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Importo da incassare (€)</label>
            <input
              type="number" min="0.01" step="0.01"
              value={amountEur}
              onChange={(e) => setAmountEur(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opzionale)</label>
            <input
              type="text" value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="es. Cena tavolo 3"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {amount > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Riepilogo</p>
              <div className="flex justify-between">
                <span className="text-gray-600">Importo</span>
                <span className="font-medium">€{amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t">
                <span className="text-gray-700 font-semibold">Ricevi</span>
                <span className="font-bold text-indigo-700 text-base">{tokenAmount.toLocaleString()} token</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading || amount <= 0}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Generazione QR..." : "Genera QR di pagamento"}
          </button>
        </div>
      ) : (
        <div className="text-center">
          {/* Countdown */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-4 ${
            countdown === 0 ? "bg-red-100 text-red-700" :
            countdownUrgent ? "bg-orange-100 text-orange-700" :
            "bg-gray-100 text-gray-600"
          }`}>
            <span>⏱</span>
            <span>{countdown === 0 ? "Scaduto" : `Scade tra ${countdownStr}`}</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
            <p className="text-sm text-gray-500 mb-4">Il cliente scansiona e paga</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="QR pagamento token"
              width={240} height={240}
              className="mx-auto rounded-xl"
            />
            <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600 flex justify-between">
              <span>Tu ricevi</span>
              <span className="font-bold text-green-700">{session.tokenAmount.toLocaleString()} token</span>
            </div>
          </div>

          {/* Indicatore attesa */}
          {countdown > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              In attesa del pagamento...
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full py-2.5 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            Annulla e nuovo pagamento
          </button>
        </div>
      )}
    </main>
  );
}
