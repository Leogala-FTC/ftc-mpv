"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TOKENS_PER_EURO = 11.7;

// Service role client — bypasses RLS, server-only
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");
  return createSupabaseClient(url, serviceKey);
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Non autenticato");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Accesso negato");
}

export async function getAdminUsers() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("profiles")
    .select("user_id,role,full_name,business_name,city,onboarding_completed,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminPayments() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminClearings() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("clearing_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateClearingStatus(id: string, status: string) {
  await assertAdmin();
  const db = getServiceClient();
  const { error } = await db
    .from("clearing_requests")
    .update({ status })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function searchUserByEmail(email: string) {
  await assertAdmin();
  const db = getServiceClient();
  // Search auth users by email
  const { data, error } = await db.auth.admin.listUsers();
  if (error) return { success: false as const, error: error.message };
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
  if (!user) return { success: false as const, error: "Utente non trovato" };
  // Get profile
  const { data: profile } = await db
    .from("profiles")
    .select("full_name,business_name,role")
    .eq("user_id", user.id)
    .single();
  return {
    success: true as const,
    userId: user.id,
    email: user.email ?? "",
    name: profile?.full_name ?? profile?.business_name ?? "",
    role: profile?.role ?? "",
  };
}

export async function adminCreditWallet(
  targetUserId: string,
  tokenAmount: number,
  reason: string,
  adminUserId: string
) {
  await assertAdmin();
  if (tokenAmount <= 0) return { success: false, error: "Importo non valido" };

  const db = getServiceClient();
  const eurEquiv = tokenAmount / TOKENS_PER_EURO;

  // Get or create wallet
  const { data: existing } = await db
    .from("wallets")
    .select("id,token_balance")
    .eq("profile_user_id", targetUserId)
    .single();

  if (existing) {
    await db
      .from("wallets")
      .update({ token_balance: existing.token_balance + tokenAmount })
      .eq("id", existing.id);
  } else {
    await db.from("wallets").insert({
      profile_user_id: targetUserId,
      token_balance: tokenAmount,
    });
  }

  // Record transaction
  await db.from("token_transactions").insert({
    profile_user_id: targetUserId,
    direction: "in",
    amount_tokens: tokenAmount,
    reason: reason || `Carica manuale admin (≈€${eurEquiv.toFixed(2)})`,
  });

  return { success: true, tokenAmount, eurEquiv };
}


export async function adminCreditEur(
  targetUserId: string,
  eurAmount: number,
  reason: string
) {
  await assertAdmin();
  if (eurAmount <= 0) return { success: false, error: "Importo non valido" };

  const db = getServiceClient();

  const { data: existing } = await db
    .from("wallets")
    .select("id,eur_balance")
    .eq("profile_user_id", targetUserId)
    .single();

  if (existing) {
    const currentEur = Number(existing.eur_balance) || 0;
    await db
      .from("wallets")
      .update({ eur_balance: currentEur + eurAmount })
      .eq("id", existing.id);
  } else {
    await db.from("wallets").insert({
      profile_user_id: targetUserId,
      token_balance: 0,
      eur_balance: eurAmount,
    });
  }

  return { success: true, eurAmount };
}

export async function getAdminWallets() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("wallets")
    .select("profile_user_id,token_balance,eur_balance");
  if (error) return [];
  return data ?? [];
}
