"use client";

import { useEffect, useState } from "react";

export default function TopupPage() {
  const [packs, setPacks] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/topup").then((r) => r.json()).then(setPacks);
  }, []);

  const buy = async (packId: number) => {
    const res = await fetch("/api/topup", { method: "POST", body: JSON.stringify({ packId }) });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Errore");
    setMsg("Top-up completato");
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Top-up</h1>
      {packs.map((p) => (
        <div key={p.id} className="card flex items-center justify-between">
          <div><p className="font-semibold">{p.name}</p><p>+{p.tokens}T</p></div>
          <button className="btn-primary" onClick={() => buy(p.id)}>Acquista</button>
        </div>
      ))}
      {msg && <p>{msg}</p>}
    </div>
  );
}
