"use client";

import { useEffect, useState } from "react";

export default function AdminClearingPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = () => fetch("/api/admin/clearing").then((r) => r.json()).then(setRows);
  useEffect(() => { load(); }, []);

  const action = async (id: string, type: "approve" | "reject" | "paid") => {
    await fetch(`/api/admin/clearing/${id}`, { method: "POST", body: JSON.stringify({ action: type }) });
    load();
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Admin Clearing</h1>
      {rows.map((r) => (
        <div className="card space-y-2" key={r.id}>
          <p>{r.id}</p><p>{r.status} · {r.requested_tokens}T · €{r.eur_estimate}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => action(r.id, "approve")}>Approva</button>
            <button className="btn-secondary" onClick={() => action(r.id, "reject")}>Rifiuta</button>
            <button className="btn-secondary" onClick={() => action(r.id, "paid")}>Segna pagato</button>
            <a className="btn-primary" href={`/api/clearing/${r.id}/pdf`}>Scarica PDF</a>
          </div>
        </div>
      ))}
    </div>
  );
}
