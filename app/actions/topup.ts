"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { TOPUP_PACKAGES } from "@/lib/stripe";

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Non autenticato");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("user_id", authData.user.id).single();
  if (profile?.role !== "admin") throw new Error("Accesso negato");
}

/** Utente invia richiesta di ricarica */
export async function createTopupRequest(packageIndex: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const pkg = TOPUP_PACKAGES[packageIndex];
  if (!pkg) return { success: false, error: "Pacchetto non valido" };

  // Controlla se c'è già una richiesta pending per questo utente
  const { data: existing } = await supabase
    .from("topup_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (existing) return { success: false, error: "Hai già una richiesta in attesa di approvazione." };

  const { error } = await supabase.from("topup_requests").insert({
    user_id: user.id,
    package_eur: pkg.eur,
    tokens: pkg.tokens,
    status: "pending",
  });

  if (error) return { success: false, error: error.message };
  return { success: true, pkg };
}

/** Admin: lista tutte le richieste */
export async function getAdminTopupRequests() {
  await assertAdmin();
  const db = getDb();

  const { data, error } = await db
    .from("topup_requests")
    .select("id,user_id,package_eur,tokens,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  // Arricchisce con nome utente
  const profiles = await db
    .from("profiles")
    .select("user_id,full_name,alias,show_alias_only");

  const profileMap = new Map(
    (profiles.data ?? []).map((p) => [p.user_id, p])
  );

  return (data ?? []).map((r) => {
    const p = profileMap.get(r.user_id);
    const name = p?.show_alias_only && p?.alias
      ? p.alias
      : p?.full_name ?? "—";
    return { ...r, userName: name };
  });
}

/** Admin: approva richiesta → accredita token */
export async function approveTopupRequest(requestId: string) {
  await assertAdmin();
  const db = getDb();

  const { data: req, error } = await db
    .from("topup_requests")
    .select("*")
    .eq("id", requestId)
    .eq("status", "pending")
    .single();

  if (error || !req) return { success: false, error: "Richiesta non trovata o già elaborata" };

  // Accredita token
  const { data: wallet } = await db
    .from("wallets").select("id,token_balance").eq("profile_user_id", req.user_id).single();

  if (wallet) {
    await db.from("wallets")
      .update({ token_balance: wallet.token_balance + req.tokens })
      .eq("id", wallet.id);
  } else {
    await db.from("wallets").insert({
      profile_user_id: req.user_id,
      token_balance: req.tokens,
      eur_balance: 0,
    });
  }

  // Registra transazione
  await db.from("token_transactions").insert({
    profile_user_id: req.user_id,
    direction: "in",
    amount_tokens: req.tokens,
    reason: `Ricarica €${req.package_eur} approvata`,
  });

  // Aggiorna status
  await db.from("topup_requests").update({ status: "approved" }).eq("id", requestId);

  revalidatePath("/admin");
  return { success: true, tokens: req.tokens };
}

/** Admin: rifiuta richiesta */
export async function rejectTopupRequest(requestId: string) {
  await assertAdmin();
  const db = getDb();
  const { error } = await db
    .from("topup_requests").update({ status: "rejected" }).eq("id", requestId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

/** Utente: vede le proprie richieste */
export async function getUserTopupRequests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("topup_requests")
    .select("id,package_eur,tokens,status,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return data ?? [];
}
