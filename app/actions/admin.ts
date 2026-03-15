"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TOKENS_PER_EURO = 11.7;

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
    .from("profiles").select("role").eq("user_id", authData.user.id).single();
  if (profile?.role !== "admin") throw new Error("Accesso negato");
}

/** Helper: formatta numero progressivo FTC-00001 */
function formatMemberNumber(n: number | null): string {
  if (!n) return "—";
  return `FTC-${String(n).padStart(5, "0")}`;
}

export { formatMemberNumber };

/** Lista utenti con email, member_number, suspended */
export async function getAdminUsersWithStatus() {
  await assertAdmin();
  const db = getServiceClient();

  const [{ data: profiles }, { data: authList }] = await Promise.all([
    db.from("profiles")
      .select("user_id,role,full_name,business_name,city,sector,onboarding_completed,created_at,suspended,member_number,cf,address,ateco,pec,iban,vat_number,alias")
      .order("member_number", { ascending: true }),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailMap = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  return (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.user_id) ?? "",
    memberNumberFormatted: formatMemberNumber(p.member_number),
  }));
}

/** Dettaglio singolo utente per admin */
export async function getAdminUserDetail(userId: string) {
  await assertAdmin();
  const db = getServiceClient();

  const [{ data: profile }, { data: wallet }, { data: txs }, authUser] = await Promise.all([
    db.from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single(),
    db.from("wallets")
      .select("token_balance,eur_balance")
      .eq("profile_user_id", userId)
      .single(),
    db.from("token_transactions")
      .select("id,direction,amount_tokens,reason,created_at")
      .eq("profile_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    db.auth.admin.getUserById(userId),
  ]);

  return {
    profile: profile ? {
      ...profile,
      email: authUser.data.user?.email ?? "",
      memberNumberFormatted: formatMemberNumber(profile.member_number),
    } : null,
    wallet: wallet ?? { token_balance: 0, eur_balance: 0 },
    transactions: txs ?? [],
  };
}

export async function getAdminPayments() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("payments").select("*")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminClearings() {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db
    .from("clearing_requests").select("*")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateClearingStatus(id: string, status: string) {
  await assertAdmin();
  const db = getServiceClient();
  const { error } = await db.from("clearing_requests").update({ status }).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function searchUserByEmail(email: string) {
  await assertAdmin();
  const db = getServiceClient();
  const { data, error } = await db.auth.admin.listUsers();
  if (error) return { success: false as const, error: error.message };
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
  if (!user) return { success: false as const, error: "Utente non trovato" };
  const { data: profile } = await db.from("profiles")
    .select("full_name,business_name,role").eq("user_id", user.id).single();
  return {
    success: true as const,
    userId: user.id,
    email: user.email ?? "",
    name: profile?.full_name ?? profile?.business_name ?? "",
    role: profile?.role ?? "",
  };
}

export async function adminCreditWallet(targetUserId: string, tokenAmount: number, reason?: string) {
  await assertAdmin();
  if (tokenAmount <= 0) return { success: false, error: "Importo non valido" };
  const db = getServiceClient();
  const eurEquiv = tokenAmount / TOKENS_PER_EURO;

  const { data: existing } = await db.from("wallets")
    .select("id,token_balance").eq("profile_user_id", targetUserId).single();

  if (existing) {
    const { error } = await db.from("wallets")
      .update({ token_balance: existing.token_balance + tokenAmount }).eq("id", existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await db.from("wallets").insert({
      profile_user_id: targetUserId, token_balance: tokenAmount, eur_balance: 0,
    });
    if (error) return { success: false, error: error.message };
  }

  await db.from("token_transactions").insert({
    profile_user_id: targetUserId,
    direction: "in",
    amount_tokens: tokenAmount,
    reason: reason || `Accredito admin (≈€${eurEquiv.toFixed(2)})`,
  });

  return { success: true, tokenAmount, eurEquiv };
}

export async function adminCreditEur(targetUserId: string, eurAmount: number) {
  await assertAdmin();
  if (eurAmount <= 0) return { success: false, error: "Importo non valido" };
  const db = getServiceClient();

  const { data: existing } = await db.from("wallets")
    .select("id,eur_balance").eq("profile_user_id", targetUserId).single();

  if (existing) {
    const { error } = await db.from("wallets")
      .update({ eur_balance: Number(existing.eur_balance) + eurAmount }).eq("id", existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await db.from("wallets").insert({
      profile_user_id: targetUserId, token_balance: 0, eur_balance: eurAmount,
    });
    if (error) return { success: false, error: error.message };
  }

  return { success: true, eurAmount };
}

/** Restituisce tutti i wallet con join ai profili */
export async function getAdminWallets() {
  await assertAdmin();
  const db = getServiceClient();
  const { data } = await db.from("wallets").select("profile_user_id,token_balance,eur_balance");
  return data ?? [];
}

export async function adminToggleSuspend(targetUserId: string, suspended: boolean) {
  await assertAdmin();
  const db = getServiceClient();
  const { error } = await db.from("profiles").update({ suspended }).eq("user_id", targetUserId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminDeleteUser(targetUserId: string) {
  await assertAdmin();
  const db = getServiceClient();
  await db.from("token_transactions").delete().eq("profile_user_id", targetUserId);
  await db.from("wallets").delete().eq("profile_user_id", targetUserId);
  await db.from("profiles").delete().eq("user_id", targetUserId);
  await db.auth.admin.deleteUser(targetUserId);
  return { success: true };
}

// Legacy — kept for compat
export async function getAdminUsers() {
  return getAdminUsersWithStatus();
}
