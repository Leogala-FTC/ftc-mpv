"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const TOKENS_PER_EURO = 11.7;
const FTC_FEE_RATE = 0.05;      // 5% fisso alla piattaforma
// cashbackRate è scelto dal merchant (default 5%)
// merchant riceve: 1 - FTC_FEE_RATE - cashbackRate (es. 90% se cashback=5%)

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

  // Cerca profilo per email tramite service role
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
  cashbackPercent: number; // % scelto dal merchant (es. 5)
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

    // Split 90 / 5 / cashback%
    const ftcFee = amountEur * FTC_FEE_RATE;                          // 5% → FTC
    const cashbackEur = amountEur * (cashbackPercent / 100);           // X% → cashback pool → token
    const merchantEur = amountEur - ftcFee - cashbackEur;              // resto → merchant
    const cashbackTokens = Math.floor(cashbackEur * TOKENS_PER_EURO);  // convertiti in token

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
        merchant_amount_eur: merchantEur,
        cashback_eur: cashbackEur,
        status: "completed",
        note: merchantNote ?? null,
      })
      .select("id")
      .single();

    if (paymentError) {
      // fallback senza colonne nuove se non esistono ancora
      const { data: paymentFallback, error: fallbackError } = await db
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
      if (fallbackError) return { success: false, error: fallbackError.message };
      if (!paymentFallback) return { success: false, error: "Pagamento non creato" };
      // usa paymentFallback
      return await creditBuyerAndMerchant(
        db, buyerUserId, merchantUserId,
        paymentFallback.id, cashbackTokens, merchantEur,
        amountEur, cashbackPercent
      );
    }

    if (!payment) return { success: false, error: "Pagamento non creato" };

    return await creditBuyerAndMerchant(
      db, buyerUserId, merchantUserId,
      payment.id, cashbackTokens, merchantEur,
      amountEur, cashbackPercent
    );
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function creditBuyerAndMerchant(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  buyerUserId: string,
  merchantUserId: string,
  paymentId: string,
  cashbackTokens: number,
  merchantEur: number,
  amountEur: number,
  cashbackPercent: number
) {
  // 2. Accredita token cashback al buyer
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
    });
  }

  // 3. Accredita token merchant (equivalente al suo 90% in token)
  const merchantTokens = Math.floor(merchantEur * TOKENS_PER_EURO);
  const { data: merchantWallet } = await db
    .from("wallets")
    .select("id,token_balance")
    .eq("profile_user_id", merchantUserId)
    .single();

  if (merchantWallet) {
    await db
      .from("wallets")
      .update({ token_balance: merchantWallet.token_balance + merchantTokens })
      .eq("id", merchantWallet.id);
  } else {
    await db.from("wallets").insert({
      profile_user_id: merchantUserId,
      token_balance: merchantTokens,
    });
  }

  // 4. Registra transazioni
  await db.from("token_transactions").insert([
    {
      profile_user_id: buyerUserId,
      payment_id: paymentId,
      direction: "in",
      amount_tokens: cashbackTokens,
      reason: `Cashback ${cashbackPercent}% su €${amountEur.toFixed(2)}`,
    },
    {
      profile_user_id: merchantUserId,
      payment_id: paymentId,
      direction: "in",
      amount_tokens: merchantTokens,
      reason: `Incasso vendita €${amountEur.toFixed(2)} (quota merchant)`,
    },
  ]);

  revalidatePath("/user/wallet");
  revalidatePath("/merchant");

  return { success: true, paymentId, cashbackTokens, merchantTokens };
}
