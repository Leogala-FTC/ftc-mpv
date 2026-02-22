"use client";

import { useEffect, useMemo, useState } from "react";
import { MERCHANT_1_ID } from "@/lib/constants";

export default function MerchantClearingPage() {
  const [available, setAvailable] = useState(0);
  const [pending, setPending] = useState(0);
  const [rate, setRate] = useState(0.02);
  const [tokens, setTokens] = useState(0);
  const [msg, setMsg] = useState("");
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/merchant/clearing?merchantId=${MERCHANT_1_ID}`).then((r) => r.json()).then((d) => {
      setAvailable(Number(d.available_tokens || 0));
      setPending(Number(d.pending_tokens || 0));
      setRate(Number(d.rate || 0.02));
      setRequests(d.requests || []);
    });
  }, []);

  const estimate = useMemo(() => (tokens * rate).toFixed(2), [tokens, rate]);

  const request = async () => {
    const res = await fetch("/api/merchant/clearing", { method: "POST", body: JSON.stringify({ merchantId: MERCHANT_1_ID, requestedTokens: tokens }) });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Errore");
    setMsg(`Richiesta inviata: ${data.id}`);
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Clearing</h1>
      <div className="card">Disponibili: {available}T · Pending: {pending}T</div>
      <div className="card space-y-2">
        <label>Token da convertire</label>
        <input type="number" value={tokens} onChange={(e) => setTokens(Number(e.target.value))} className="w-full rounded border p-2" />
        <p>Stima €: {estimate}</p>
        <div className="flex gap-2"><button className="btn-secondary" onClick={() => setTokens(available)}>MAX</button><button className="btn-primary" onClick={request}>Richiedi clearing</button></div>
      </div>
            <div className="card"><h2 className="font-semibold">Richieste</h2>{requests.map((r) => <p key={r.id}><a className="underline" href={`/api/clearing/${r.id}/pdf`}>{r.status} · {r.requested_tokens}T · PDF</a></p>)}</div>
      {msg && <p>{msg}</p>}
    </div>
  );
}
