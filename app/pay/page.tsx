"use client";

import { useState } from "react";

export default function PayPage() {
  const [code, setCode] = useState("");
  const [session, setSession] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch("/api/pay", { method: "POST", body: JSON.stringify({ sessionId: code, action: "preview" }) });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Errore");
    setSession(data);
  };

  const confirm = async () => {
    const res = await fetch("/api/pay", { method: "POST", body: JSON.stringify({ sessionId: code, action: "confirm" }) });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Errore");
    setMsg("Pagamento completato ✅");
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Paga con Token</h1>
      <p className="text-sm">Scanner camera opzionale. MVP usa input manuale.</p>
      <input className="w-full rounded border p-2" placeholder="Incolla codice sessione" value={code} onChange={(e) => setCode(e.target.value)} />
      <button className="btn-secondary" onClick={load}>Carica</button>
      {session && <div className="card"><p>Costo: <b>{session.amount_tokens} T</b></p><button className="btn-primary mt-2" onClick={confirm}>Conferma</button></div>}
      {msg && <p>{msg}</p>}
    </div>
  );
}
