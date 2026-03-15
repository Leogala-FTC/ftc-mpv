"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTokenPaymentSession, confirmTokenPayment } from "@/app/actions/token-payment";
import { TOKENS_PER_EURO } from "@/lib/stripe";

type SessionData = {
  id: string;
  amount_eur: number;
  token_amount: number;
  fee_tokens: number;
  total_tokens: number;
  note: string | null;
  merchantName: string;
  expires_at: string;
};

export default function PayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await getTokenPaymentSession(sessionId);
      if (!res.success || !("session" in res)) {
        setError(res.error ?? "Sessione non valida");
      } else {
        setSessionData(res.session as SessionData);
        setUserBalance(res.userTokenBalance);
      }
      setLoading(false);
    }
    load();
  }, [sessionId]);

  async function handlePay() {
    setPaying(true);
    setError("");
    const res = await confirmTokenPayment(sessionId);
    if (res.success) {
      setDone(true);
    } else {
      setError(res.error ?? "Errore pagamento");
    }
    setPaying(false);
  }

  if (loading) return (
    <main className="mx-auto max-w-sm px-4 py-12 text-center">
      <p className="text-sm text-gray-500">Caricamento...</p>
    </main>
  );

  if (done && sessionData) return (
    <main className="mx-auto max-w-sm px-4 py-12 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h1 className="text-xl font-bold text-green-700 mb-2">Pagamento completato</h1>
      <p className="text-sm text-gray-600 mb-1">
        Hai pagato <strong>{sessionData.total_tokens.toLocaleString()} token</strong>
      </p>
      <p className="text-sm text-gray-500 mb-6">
        a {sessionData.merchantName}
      </p>
      <button
        onClick={() => router.push("/user")}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold"
      >
        Torna alla home
      </button>
    </main>
  );

  if (error && !sessionData) return (
    <main className="mx-auto max-w-sm px-4 py-12 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <p className="text-sm text-red-600 font-medium">{error}</p>
      <button onClick={() => router.push("/user")} className="mt-6 text-sm text-indigo-600 underline">
        Torna alla home
      </button>
    </main>
  );

  if (!sessionData) return null;

  const hasEnough = userBalance >= sessionData.total_tokens;

  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <div className="text-center mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Pagamento a</p>
        <h1 className="text-2xl font-bold text-gray-900">{sessionData.merchantName}</h1>
        {sessionData.note && <p className="text-sm text-gray-500 mt-1">{sessionData.note}</p>}
      </div>

      {/* Importo principale */}
      <div className="bg-indigo-600 text-white rounded-2xl p-6 text-center mb-4">
        <p className="text-sm opacity-70 mb-1">Totale da pagare</p>
        <p className="text-4xl font-bold">{sessionData.total_tokens.toLocaleString()}</p>
        <p className="text-sm opacity-70 mt-1">token</p>
      </div>

      {/* Dettaglio */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Importo</span>
          <span className="font-medium">€{Number(sessionData.amount_eur).toFixed(2)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between">
          <span className="text-gray-700 font-medium">Il tuo saldo</span>
          <span className={`font-semibold ${hasEnough ? "text-green-600" : "text-red-500"}`}>
            {userBalance.toLocaleString()} token
          </span>
        </div>
      </div>

      {!hasEnough && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
          Saldo insufficiente. Ti mancano {(sessionData.total_tokens - userBalance).toLocaleString()} token.
          <button
            onClick={() => router.push("/user/topup")}
            className="block mt-2 text-indigo-600 font-medium underline text-xs"
          >
            Ricarica ora →
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500 mb-4 text-center">{error}</p>}

      <button
        onClick={handlePay}
        disabled={paying || !hasEnough}
        className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-base font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {paying ? "Pagamento in corso..." : `Paga ${sessionData.total_tokens.toLocaleString()} token`}
      </button>

      <p className="text-xs text-gray-400 text-center mt-3">
        ≈ €{(sessionData.total_tokens / TOKENS_PER_EURO).toFixed(2)} · Scade alle{" "}
        {new Date(sessionData.expires_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </main>
  );
}
