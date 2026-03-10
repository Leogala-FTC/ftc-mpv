"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TOKENS_PER_EURO = 11.7;

export async function createClearingRequest(tokenAmount: number) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Non autenticato" };
    }

    // Check merchant wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, token_balance")
      .eq("profile_user_id", user.id)
      .single();

    if (walletError || !wallet) {
      return { success: false, error: "Wallet non trovato" };
    }

    if (wallet.token_balance < tokenAmount) {
      return { success: false, error: "Saldo token insufficiente" };
    }

    // Get IBAN from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("iban")
      .eq("user_id", user.id)
      .single();

    const eurAmount = tokenAmount / TOKENS_PER_EURO;

    // Insert clearing request
    const { data: clearing, error: clearingError } = await supabase
      .from("clearing_requests")
      .insert({
        merchant_user_id: user.id,
        token_amount: tokenAmount,
        eur_amount: eurAmount,
        iban: profile?.iban ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (clearingError) {
      return { success: false, error: clearingError.message };
    }

    // Deduct tokens from wallet
    await supabase
      .from("wallets")
      .update({ token_balance: wallet.token_balance - tokenAmount })
      .eq("id", wallet.id);

    // Record token transaction
    await supabase.from("token_transactions").insert({
      profile_user_id: user.id,
      clearing_request_id: clearing.id,
      direction: "out",
      amount_tokens: tokenAmount,
      reason: `Richiesta clearing €${eurAmount.toFixed(2)}`,
    });

    revalidatePath("/merchant/clearing");
    revalidatePath("/merchant");

    return { success: true, clearingId: clearing.id, eurAmount };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
