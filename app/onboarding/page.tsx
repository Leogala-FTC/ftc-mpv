"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase-client";

type Role = "user" | "merchant";
type AnyRole = Role | "admin";
type Step = 1 | 2;

type ProfileRow = {
  id?: string;
  user_id?: string;
  role: AnyRole | null;
  onboarding_completed: boolean | null;
};

type UserForm = {
  full_name: string;
  alias: string;
  use_alias_only: boolean;
  codice_fiscale: string;
  address: string;
  city: string;
};

type MerchantForm = {
  ragione_sociale: string;
  partita_iva: string;
  codice_fiscale: string;
  address: string;
  city: string;
  ateco: string;
  pec: string;
  iban: string;
  sector: string;
};

const SECTOR_OPTIONS = [
  "Bar",
  "Ristorante",
  "Pizzeria",
  "Pub",
  "Centro estetico",
  "Palestra",
  "Negozio abbigliamento",
  "Parrucchiere",
  "Hotel/B&B",
  "Locale notturno",
] as const;

const INITIAL_USER_FORM: UserForm = {
  full_name: "",
  alias: "",
  use_alias_only: false,
  codice_fiscale: "",
  address: "",
  city: "",
};

const INITIAL_MERCHANT_FORM: MerchantForm = {
  ragione_sociale: "",
  partita_iva: "",
  codice_fiscale: "",
  address: "",
  city: "",
  ateco: "",
  pec: "",
  iban: "",
  sector: "",
};

function redirectByRole(role: AnyRole, router: ReturnType<typeof useRouter>) {
  if (role === "admin") {
    router.push("/admin");
    return;
  }

  if (role === "merchant") {
    router.push("/merchant");
    return;
  }

  router.push("/user");
}

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>("user");
  const [userForm, setUserForm] = useState<UserForm>(INITIAL_USER_FORM);
  const [merchantForm, setMerchantForm] = useState<MerchantForm>(INITIAL_MERCHANT_FORM);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const supabase = getSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.push("/");
        return;
      }

      const userId = authData.user.id;

      const { data: byIdProfile } = await supabase
        .from("profiles")
        .select("id,user_id,role,onboarding_completed")
        .eq("id", userId)
        .maybeSingle<ProfileRow>();

      const profile =
        byIdProfile ??
        (
          await supabase
            .from("profiles")
            .select("id,user_id,role,onboarding_completed")
            .eq("user_id", userId)
            .maybeSingle<ProfileRow>()
        ).data;

      if (profile?.onboarding_completed && profile.role) {
        redirectByRole(profile.role, router);
        return;
      }

      if (mounted) {
        setInitialLoading(false);
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [router]);

  const roleSelected = Boolean(role);

  const userValid = useMemo(() => {
    return (
      userForm.full_name.trim().length > 0 &&
      userForm.codice_fiscale.trim().length > 0 &&
      userForm.address.trim().length > 0 &&
      userForm.city.trim().length > 0
    );
  }, [userForm]);

  const merchantValid = useMemo(() => {
    return (
      merchantForm.ragione_sociale.trim().length > 0 &&
      merchantForm.partita_iva.trim().length > 0 &&
      merchantForm.address.trim().length > 0 &&
      merchantForm.city.trim().length > 0 &&
      merchantForm.ateco.trim().length > 0 &&
      merchantForm.pec.trim().length > 0 &&
      merchantForm.iban.trim().length > 0 &&
      merchantForm.sector.trim().length > 0
    );
  }, [merchantForm]);

  const isStepTwoValid = role === "user" ? userValid : merchantValid;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isStepTwoValid) {
      return;
    }

    setError(null);
    setLoading(true);

    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setError("Sessione non valida. Effettua di nuovo l'accesso.");
      setLoading(false);
      router.push("/");
      return;
    }

    const userId = authData.user.id;

    const payload =
      role === "user"
        ? {
            role,
            onboarding_completed: true,
            full_name: userForm.full_name.trim(),
            alias: userForm.alias.trim() || null,
            use_alias_only: userForm.use_alias_only,
            codice_fiscale: userForm.codice_fiscale.trim(),
            address: userForm.address.trim(),
            city: userForm.city.trim(),
          }
        : {
            role,
            onboarding_completed: true,
            ragione_sociale: merchantForm.ragione_sociale.trim(),
            partita_iva: merchantForm.partita_iva.trim(),
            codice_fiscale: merchantForm.codice_fiscale.trim() || null,
            address: merchantForm.address.trim(),
            city: merchantForm.city.trim(),
            ateco: merchantForm.ateco.trim(),
            pec: merchantForm.pec.trim(),
            iban: merchantForm.iban.trim(),
            sector: merchantForm.sector,
          };

    const idUpdate = await supabase.from("profiles").update(payload).eq("id", userId).select("id").maybeSingle();

    let updateError = idUpdate.error;
    let updated = Boolean(idUpdate.data);

    if (!updated) {
      const userIdUpdate = await supabase
        .from("profiles")
        .update(payload)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      updateError = userIdUpdate.error;
      updated = Boolean(userIdUpdate.data);
    }

    if (updateError || !updated) {
      setError(updateError?.message ?? "Impossibile completare l'onboarding. Riprova.");
      setLoading(false);
      return;
    }

    if (role === "merchant") {
      router.push("/merchant");
      return;
    }

    router.push("/user");
  };

  if (initialLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-gray-700">Caricamento onboarding...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Completa il profilo</h1>
        <p className="mt-2 text-sm text-gray-700">
          Inserisci i dati necessari per attivare il tuo account FTC MVP.
        </p>

        {error ? <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {step === 1 ? (
          <section className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className={`rounded border p-4 text-left ${role === "user" ? "border-black bg-gray-50" : "border-gray-300"}`}
                onClick={() => setRole("user")}
                type="button"
              >
                <p className="text-sm font-semibold">User</p>
                <p className="mt-1 text-xs text-gray-600">Profilo cliente finale.</p>
              </button>

              <button
                className={`rounded border p-4 text-left ${role === "merchant" ? "border-black bg-gray-50" : "border-gray-300"}`}
                onClick={() => setRole("merchant")}
                type="button"
              >
                <p className="text-sm font-semibold">Merchant</p>
                <p className="mt-1 text-xs text-gray-600">Profilo attività commerciale.</p>
              </button>
            </div>

            <button
              className="w-full rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={!roleSelected}
              onClick={() => setStep(2)}
              type="button"
            >
              Continua
            </button>
          </section>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
            {role === "user" ? (
              <>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setUserForm((current) => ({ ...current, full_name: event.target.value }))}
                  placeholder="Nome e Cognome"
                  required
                  type="text"
                  value={userForm.full_name}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setUserForm((current) => ({ ...current, alias: event.target.value }))}
                  placeholder="Alias (opzionale)"
                  type="text"
                  value={userForm.alias}
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    checked={userForm.use_alias_only}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        use_alias_only: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Usa solo alias
                </label>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setUserForm((current) => ({ ...current, codice_fiscale: event.target.value }))
                  }
                  placeholder="Codice fiscale"
                  required
                  type="text"
                  value={userForm.codice_fiscale}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setUserForm((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Indirizzo"
                  required
                  type="text"
                  value={userForm.address}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setUserForm((current) => ({ ...current, city: event.target.value }))}
                  placeholder="Città"
                  required
                  type="text"
                  value={userForm.city}
                />
              </>
            ) : (
              <>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setMerchantForm((current) => ({ ...current, ragione_sociale: event.target.value }))
                  }
                  placeholder="Ragione sociale"
                  required
                  type="text"
                  value={merchantForm.ragione_sociale}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setMerchantForm((current) => ({ ...current, partita_iva: event.target.value }))
                  }
                  placeholder="Partita IVA"
                  required
                  type="text"
                  value={merchantForm.partita_iva}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setMerchantForm((current) => ({ ...current, codice_fiscale: event.target.value }))
                  }
                  placeholder="Codice fiscale (opzionale)"
                  type="text"
                  value={merchantForm.codice_fiscale}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setMerchantForm((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Indirizzo"
                  required
                  type="text"
                  value={merchantForm.address}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setMerchantForm((current) => ({ ...current, city: event.target.value }))}
                  placeholder="Città"
                  required
                  type="text"
                  value={merchantForm.city}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setMerchantForm((current) => ({ ...current, ateco: event.target.value }))}
                  placeholder="ATECO"
                  required
                  type="text"
                  value={merchantForm.ateco}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setMerchantForm((current) => ({ ...current, pec: event.target.value }))}
                  placeholder="PEC"
                  required
                  type="email"
                  value={merchantForm.pec}
                />
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setMerchantForm((current) => ({ ...current, iban: event.target.value }))}
                  placeholder="IBAN"
                  required
                  type="text"
                  value={merchantForm.iban}
                />
                <select
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  onChange={(event) => setMerchantForm((current) => ({ ...current, sector: event.target.value }))}
                  required
                  value={merchantForm.sector}
                >
                  <option value="">Seleziona settore</option>
                  {SECTOR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="mt-4 flex gap-3">
              <button
                className="w-1/2 rounded border border-gray-300 px-4 py-2 text-sm"
                onClick={() => setStep(1)}
                type="button"
              >
                Indietro
              </button>
              <button
                className="w-1/2 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={loading || !isStepTwoValid}
                type="submit"
              >
                {loading ? "Salvataggio..." : "Completa onboarding"}
              </button>
            </div>

            {!isStepTwoValid ? (
              <p className="text-sm text-red-600">Compila tutti i campi obbligatori prima di continuare.</p>
            ) : null}
          </form>
        )}
      </div>
    </main>
  );
}
