"use client";

import { FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const supabase = getSupabaseClient();
    const redirectTo = `${window.location.origin}/reset-confirm`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Controlla la tua email per il reset password.");
  };

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold">Password dimenticata</h1>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
          type="email"
          value={email}
        />
        <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
          Invia email reset
        </button>
      </form>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </main>
  );
}
