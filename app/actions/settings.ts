"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non autenticato");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("user_id", data.user.id).single();
  if (profile?.role !== "admin") throw new Error("Accesso negato");
}

export async function getPlatformSettings() {
  const db = getDb();
  const { data } = await db.from("platform_settings").select("key,value");
  const map: Record<string, number> = { fee_eur_percent: 5, fee_token_percent: 3 };
  (data ?? []).forEach((r) => { map[r.key] = parseFloat(r.value); });
  return map;
}

export async function updatePlatformSetting(key: string, value: number) {
  await assertAdmin();
  const db = getDb();
  await db.from("platform_settings")
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() });
  return { success: true };
}

/** Cashback setting del merchant corrente */
export async function getMerchantCashback() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { percent: 3 };
  const { data } = await supabase
    .from("cashback_settings")
    .select("cashback_percent")
    .eq("merchant_user_id", user.id)
    .single();
  return { percent: Number(data?.cashback_percent ?? 3) };
}

export async function setMerchantCashback(percent: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };
  if (percent < 1 || percent > 20) return { success: false, error: "Percentuale non valida (1–20%)" };

  const { error } = await supabase
    .from("cashback_settings")
    .upsert({
      merchant_user_id: user.id,
      cashback_percent: percent,
      updated_at: new Date().toISOString(),
    }, { onConflict: "merchant_user_id" });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Top 10 merchant per cashback (per user home + classifica) */
export async function getTopMerchants(limit = 10) {
  const db = getDb();

  const { data: settings } = await db
    .from("cashback_settings")
    .select("merchant_user_id, cashback_percent")
    .order("cashback_percent", { ascending: false })
    .limit(limit);

  if (!settings?.length) return [];

  const ids = settings.map((s) => s.merchant_user_id);
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, business_name, full_name, sector, city")
    .in("user_id", ids)
    .eq("suspended", false);

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return settings.map((s) => {
    const p = profileMap.get(s.merchant_user_id);
    return {
      userId: s.merchant_user_id,
      name: p?.business_name ?? p?.full_name ?? "Esercente",
      sector: p?.sector ?? "",
      city: p?.city ?? "",
      cashbackPercent: Number(s.cashback_percent),
    };
  }).filter((m) => profileMap.has(m.userId));
}
