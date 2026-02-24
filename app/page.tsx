"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

type AuthTab = "login" | "register";
type LoginRole = "user" | "merchant";
type ProfileRole = "user" | "merchant" | "admin";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>("login");
  const [loginRole, setLoginRole] = useState<LoginRole>("user");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);


  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? "Login failed");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,onboarded")
      .eq("id", data.user.id)
      .maybeSingle<{ role: ProfileRole; onboarded: boolean }>();

    if (profileError || !profile || !profile.onboarded) {
      router.push(`/onboarding?role=${loginRole}`);
      return;
    }

    if (profile.role === "merchant") {
      router.push("/merchant");
      return;
    }

    if (profile.role === "admin") {
      router.push("/admin");
      return;
    }

    router.push("/user");
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: registerEmail,
      password: registerPassword,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push("/onboarding");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
      <div className="w-full rounded border border-gray-200 bg-white p-6">
        <h1 className="mb-4 text-center text-xl font-semibold">FTC MVP</h1>

        <div className="mb-4 inline-flex w-full rounded border border-gray-300 p-1">
          <button
            className={`w-1/2 rounded px-3 py-2 text-sm ${tab === "login" ? "bg-black text-white" : "text-gray-700"}`}
            onClick={() => setTab("login")}
            type="button"
          >
            Accedi
          </button>
          <button
            className={`w-1/2 rounded px-3 py-2 text-sm ${tab === "register" ? "bg-black text-white" : "text-gray-700"}`}
            onClick={() => setTab("register")}
            type="button"
          >
            Registrati
          </button>
        </div>

        {tab === "login" ? (
          <form className="space-y-3" onSubmit={handleLogin}>
            <fieldset className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  checked={loginRole === "user"}
                  name="role"
                  onChange={() => setLoginRole("user")}
                  type="radio"
                />
                User
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  checked={loginRole === "merchant"}
                  name="role"
                  onChange={() => setLoginRole("merchant")}
                  type="radio"
                />
                Merchant
              </label>
            </fieldset>

            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="Email"
              required
              type="email"
              value={loginEmail}
            />
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={loginPassword}
            />

            <button
              className="w-full rounded bg-black px-3 py-2 text-sm text-white"
              disabled={loading}
              type="submit"
            >
              Accedi
            </button>

            <Link className="block text-sm text-blue-600 underline" href="/forgot">
              Password dimenticata
            </Link>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={handleRegister}>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              onChange={(event) => setRegisterEmail(event.target.value)}
              placeholder="Email"
              required
              type="email"
              value={registerEmail}
            />
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              onChange={(event) => setRegisterPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={registerPassword}
            />

            <button
              className="w-full rounded bg-black px-3 py-2 text-sm text-white"
              disabled={loading}
              type="submit"
            >
              Crea account
            </button>
          </form>
        )}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </main>
  );
}
