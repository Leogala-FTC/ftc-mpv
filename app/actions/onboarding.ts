"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type OnboardingPayload = {
  role: "user" | "merchant";
  full_name?: string;
  alias?: string | null;
  show_alias_only?: boolean;
  cf?: string | null;
  address?: string;
  city?: string;
  business_name?: string;
  vat_number?: string;
  ateco?: string;
  pec?: string;
  iban?: string;
  sector?: string;
};

export async function completeOnboarding(payload: OnboardingPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const db = getDb();

  // 1. Aggiorna profilo + onboarding_completed
  const { error: profileError } = await db
    .from("profiles")
    .update({ ...payload, onboarding_completed: true })
    .eq("user_id", user.id);

  if (profileError) return { success: false, error: profileError.message };

  // 2. Crea wallet se non esiste già
  const { data: existingWallet } = await db
    .from("wallets")
    .select("id")
    .eq("profile_user_id", user.id)
    .single();

  if (!existingWallet) {
    const { error: walletError } = await db.from("wallets").insert({
      profile_user_id: user.id,
      token_balance: 0,
    });
    if (walletError) return { success: false, error: "Errore creazione wallet: " + walletError.message };
  }

  return { success: true, role: payload.role };
}

/** Gate: controlla che l'utente abbia completato l'onboarding, altrimenti redirect */
export async function requireOnboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed, suspended")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/");
  if (profile.suspended) redirect("/?error=suspended");
  if (!profile.onboarding_completed) redirect("/onboarding");

  return profile;
}
