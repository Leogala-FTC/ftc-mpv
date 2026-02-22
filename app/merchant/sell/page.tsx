"use client";

import { useEffect, useState } from "react";
import { SUPPORTED_AMOUNTS_EUR, MERCHANT_1_ID } from "@/lib/constants";
import { SessionQr } from "@/components/qr-session";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function MerchantSellPage() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState("Nessuna sessione");

  const createSession = async (amount: number) => {
    const res = await fetch("/api/merchant/session", { method: "POST", body: JSON.stringify({ merchantId: MERCHANT_1_ID, amountEur: amount }) });
    const data = await res.json();
    if (!res.ok) return setStatus(data.error || "Errore");
    setSession(data);
    setStatus("In attesa di pagamento...");
  };

  useEffect(() => {
    if (!session?.id) return;
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`payment-${session.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payment_sessions", filter: `id=eq.${session.id}` }, (payload) => {
        const row: any = payload.new;
        if (row.status === "paid") setStatus("✅ Pagato");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Vendi</h1>
      <div className="grid grid-cols-3 gap-2">
        {SUPPORTED_AMOUNTS_EUR.map((a) => <button className="btn-secondary" key={a} onClick={() => createSession(a)}>{a}€</button>)}
      </div>
      {session && <div className="card space-y-2"><p>Sessione: {session.id}</p><p>Costo: {session.amount_tokens}T</p><SessionQr sessionId={session.id} /><p>{status}</p></div>}
    </div>
  );
}
