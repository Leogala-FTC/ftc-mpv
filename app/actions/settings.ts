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

// ─── Platform-wide fee settings ───────────────────────────────────────────

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

// ─── Per-merchant fee overrides ────────────────────────────────────────────

export async function getMerchantFees(merchantUserId: string) {
  const db = getDb();
  const [{ data: overrides }, global] = await Promise.all([
    db.from("merchant_fees")
      .select("fee_eur_percent,fee_token_percent")
      .eq("merchant_user_id", merchantUserId)
      .single(),
    getPlatformSettings(),
  ]);
  return {
    feeEurPercent: overrides?.fee_eur_percent != null
      ? Number(overrides.fee_eur_percent)
      : global.fee_eur_percent,
    feeTokenPercent: overrides?.fee_token_percent != null
      ? Number(overrides.fee_token_percent)
      : global.fee_token_percent,
    hasOverride: overrides != null,
  };
}

export async function getAdminMerchantFees() {
  await assertAdmin();
  const db = getDb();

  const [{ data: merchants }, { data: overrides }, global] = await Promise.all([
    db.from("profiles")
      .select("user_id,business_name,full_name,city,sector")
      .eq("role", "merchant")
      .order("business_name"),
    db.from("merchant_fees").select("*"),
    getPlatformSettings(),
  ]);

  const overrideMap = new Map((overrides ?? []).map((o) => [o.merchant_user_id, o]));

  return (merchants ?? []).map((m) => {
    const ov = overrideMap.get(m.user_id);
    return {
      userId: m.user_id,
      name: m.business_name ?? m.full_name ?? "—",
      city: m.city ?? "",
      sector: m.sector ?? "",
      feeEur: ov?.fee_eur_percent != null ? Number(ov.fee_eur_percent) : null,
      feeToken: ov?.fee_token_percent != null ? Number(ov.fee_token_percent) : null,
      globalFeeEur: global.fee_eur_percent,
      globalFeeToken: global.fee_token_percent,
    };
  });
}

export async function setMerchantFeeOverride(
  merchantUserId: string,
  feeEurPercent: number | null,
  feeTokenPercent: number | null,
) {
  await assertAdmin();
  const db = getDb();

  if (feeEurPercent === null && feeTokenPercent === null) {
    // Rimuovi override — torna alla fee globale
    await db.from("merchant_fees").delete().eq("merchant_user_id", merchantUserId);
    return { success: true };
  }

  await db.from("merchant_fees").upsert({
    merchant_user_id: merchantUserId,
    fee_eur_percent: feeEurPercent,
    fee_token_percent: feeTokenPercent,
    updated_at: new Date().toISOString(),
  }, { onConflict: "merchant_user_id" });

  return { success: true };
}

// ─── Cashback merchant (con weekly lock) ──────────────────────────────────

function getWeekKey(date = new Date()): string {
  // ISO week: YYYY-Www
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getNextMondayMidnight(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next;
}

export async function getMerchantCashback() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { percent: 3, weekKey: getWeekKey(), alreadySetThisWeek: false, nextUpdateAt: getNextMondayMidnight().toISOString() };

  const { data } = await supabase
    .from("cashback_settings")
    .select("cashback_percent,week_key,last_set_at")
    .eq("merchant_user_id", user.id)
    .single();

  const currentWeek = getWeekKey();
  const alreadySetThisWeek = data?.week_key === currentWeek;
  const nextUpdateAt = getNextMondayMidnight().toISOString();

  return {
    percent: Number(data?.cashback_percent ?? 3),
    weekKey: currentWeek,
    alreadySetThisWeek,
    nextUpdateAt,
    lastSetAt: data?.last_set_at ?? null,
  };
}

export async function setMerchantCashback(percent: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };
  if (percent < 1 || percent > 20) return { success: false, error: "Percentuale non valida (1–20%)" };

  // Controlla lock settimanale server-side
  const currentWeek = getWeekKey();
  const { data: existing } = await supabase
    .from("cashback_settings")
    .select("week_key")
    .eq("merchant_user_id", user.id)
    .single();

  if (existing?.week_key === currentWeek) {
    return { success: false, error: "Hai già impostato il cashback questa settimana. Puoi modificarlo dal prossimo lunedì." };
  }

  const { error } = await supabase
    .from("cashback_settings")
    .upsert({
      merchant_user_id: user.id,
      cashback_percent: percent,
      week_key: currentWeek,
      last_set_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "merchant_user_id" });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Top 10 merchant per cashback */
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
