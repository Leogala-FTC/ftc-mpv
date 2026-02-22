"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const signUp = async (e: FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return setMsg(error.message);
    if (data.user) {
      await fetch("/api/auth/signup", { method: "POST", body: JSON.stringify({ name }) });
    }
    setMsg("Registrazione completata. Verifica email se richiesto.");
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);
    router.push("/home");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Accesso</h1>
      <form className="card space-y-3">
        <input className="w-full rounded border p-2" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full rounded border p-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="w-full rounded border p-2" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={signUp}>Registrati</button>
          <button className="btn-primary" onClick={signIn}>Accedi</button>
        </div>
      </form>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
