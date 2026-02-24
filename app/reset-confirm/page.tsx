"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";

export default function ResetConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/");
  };

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold">Imposta nuova password</h1>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nuova password"
          required
          type="password"
          value={password}
        />
        <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
          Salva password
        </button>
      </form>
      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
    </main>
  );
}
