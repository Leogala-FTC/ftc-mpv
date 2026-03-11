"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const TOKENS_PER_EURO = 11.7;
const FTC_FEE_RATE = 0.05; // 5% fisso alla piattaforma

function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function findUserByEmail(email: string) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { success: false as const, error: "Non autenticato" };

  const db = getServiceDb();
  const { data: users } = await db.auth.admin.listUsers();
  const found = users?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
  );
  if (!found) return { success: false as const, error: "Cliente non trovato" };

  const { data: profile } = await db
    .from("profiles")
    .select("full_name,alias,show_alias_only")
    .eq("user_id", found.id)
    .single();

  const displayName =
    profile?.show_alias_only && profile?.alias
      ? profile.alias
      : profile?.full_name ?? found.email ?? "";

  return { success: true as const, userId: found.id, displayName };
}

export interface CreatePaymentInput {
  buyerUserId: string;
  amountEur: number;
  cashbackPercent: number;
  merchantNote?: string;
}

export async function createPayment(input: CreatePaymentInput) {
  const { buyerUserId, amountEur, cashbackPercent, merchantNote } = input;

  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { success: false, error: "Non autenticato" };

    const merchantUserId = authData.user.id;
    const db = getServiceDb();

    // Split: cashbackPercent% → token buyer | FTC_FEE% → FTC | resto → merchant EUR
    const ftcFee = amountEur * FTC_FEE_RATE;
    const cashbackEur = amountEur * (cashbackPercent / 100);
    const merchantEur = amountEur - ftcFee - cashbackEur;
    const cashbackTokens = Math.floor(cashbackEur * TOKENS_PER_EURO);

    // 1. Inserisce pagamento
    const { data: payment, error: paymentError } = await db
      .from("payments")
      .insert({
        merchant_user_id: merchantUserId,
        buyer_user_id: buyerUserId,
        amount_eur: amountEur,
        fee_eur: ftcFee,
        cashback_tokens: cashbackTokens,
        cashback_percent: cashbackPercent,
        status: "completed",
        note: merchantNote ?? null,
      })
      .select("id")
      .single();

    if (paymentError) return { success: false, error: paymentError.message };
    if (!payment) return { success: false, error: "Pagamento non creato" };

    // 2. Accredita TOKEN cashback al buyer (utente)
    const { data: buyerWallet } = await db
      .from("wallets")
      .select("id,token_balance")
      .eq("profile_user_id", buyerUserId)
      .single();

    if (buyerWallet) {
      await db
        .from("wallets")
        .update({ token_balance: buyerWallet.token_balance + cashbackTokens })
        .eq("id", buyerWallet.id);
    } else {
      await db.from("wallets").insert({
        profile_user_id: buyerUserId,
        token_balance: cashbackTokens,
        eur_balance: 0,
      });
    }

    // 3. Accredita EUR al merchant
    const { data: merchantWallet } = await db
      .from("wallets")
      .select("id,eur_balance")
      .eq("profile_user_id", merchantUserId)
      .single();

    if (merchantWallet) {
      const currentEur = Number(merchantWallet.eur_balance) || 0;
      await db
        .from("wallets")
        .update({ eur_balance: currentEur + merchantEur })
        .eq("id", merchantWallet.id);
    } else {
      await db.from("wallets").insert({
        profile_user_id: merchantUserId,
        token_balance: 0,
        eur_balance: merchantEur,
      });
    }

    // 4. Registra transazione token per il buyer
    await db.from("token_transactions").insert({
      profile_user_id: buyerUserId,
      payment_id: payment.id,
      direction: "in",
      amount_tokens: cashbackTokens,
      reason: `Cashback ${cashbackPercent}% su €${amountEur.toFixed(2)}`,
    });

    revalidatePath("/user/wallet");
    revalidatePath("/merchant");

    return {
      success: true,
      paymentId: payment.id,
      cashbackTokens,
      merchantEur,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
