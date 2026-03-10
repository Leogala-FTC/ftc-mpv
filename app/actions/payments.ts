"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TOKENS_PER_EURO = 11.7;
const PAYMENT_FEE_RATE = 0.05;

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    const fee = amountEur * PAYMENT_FEE_RATE;
    const cashbackTokens = Math.floor(
      amountEur * (cashbackPercent / 100) * TOKENS_PER_EURO
    );

    // Insert payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        merchant_user_id: user.id,
        buyer_user_id: buyerUserId,
        amount_eur: amountEur,
        fee_eur: fee,
        cashback_tokens: cashbackTokens,
        cashback_percent: cashbackPercent,
        status: "completed",
        note: merchantNote ?? null,
      })
      .select("id")
      .single();

    if (paymentError) {
      return { success: false, error: paymentError.message };
    }

    // Get or create buyer wallet
    const { data: existingWallet } = await supabase
      .from("wallets")
      .select("id, token_balance")
      .eq("profile_user_id", buyerUserId)
      .single();

    if (existingWallet) {
      await supabase
        .from("wallets")
        .update({ token_balance: existingWallet.token_balance + cashbackTokens })
        .eq("id", existingWallet.id);
    } else {
      await supabase.from("wallets").insert({
        profile_user_id: buyerUserId,
        token_balance: cashbackTokens,
      });
    }

    // Record token transaction
    await supabase.from("token_transactions").insert({
      profile_user_id: buyerUserId,
      payment_id: payment.id,
      direction: "in",
      amount_tokens: cashbackTokens,
      reason: `Cashback pagamento €${amountEur.toFixed(2)}`,
    });

    revalidatePath("/user/wallet");

    return { success: true, paymentId: payment.id, cashbackTokens };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
