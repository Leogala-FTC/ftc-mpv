"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const TOKENS_PER_EURO = 11.7;

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Il merchant richiede un prelievo di X euro.
 * X euro = X * 11.7 token che vengono scalati dal token_balance.
 * Si crea una clearing_request con eur_amount = X e token_amount = X * 11.7.
 */
export async function createClearingRequest(eurAmount: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Non autenticato" };

    const db = getDb();

    // Leggi token_balance (unico portafoglio)
    const { data: wallet, error: walletError } = await db
      .from("wallets")
      .select("id, token_balance")
      .eq("profile_user_id", user.id)
      .single();

    if (walletError || !wallet) return { success: false, error: "Wallet non trovato" };

    const tokenAmount = Math.floor(eurAmount * TOKENS_PER_EURO);
    const currentTokens = Number(wallet.token_balance) || 0;

    if (currentTokens < tokenAmount) {
      return {
        success: false,
        error: `Saldo insufficiente. Hai ${currentTokens.toLocaleString("it-IT")} token (≈ €${(currentTokens / TOKENS_PER_EURO).toFixed(2)}).`,
      };
    }

    // Recupera IBAN
    const { data: profile } = await db
      .from("profiles")
      .select("iban")
      .eq("user_id", user.id)
      .single();

    // Inserisce clearing request (eur_amount omesso: schema cache non aggiornata)
    const { data: clearing, error: clearingError } = await db
      .from("clearing_requests")
      .insert({
        merchant_user_id: user.id,
        token_amount: tokenAmount,
        iban: profile?.iban ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (clearingError) return { success: false, error: clearingError.message };

    // Scala i token dal wallet
    await db
      .from("wallets")
      .update({ token_balance: currentTokens - tokenAmount })
      .eq("id", wallet.id);

    // Registra la transazione
    await db.from("token_transactions").insert({
      profile_user_id: user.id,
      direction: "out",
      amount_tokens: tokenAmount,
      reason: `Prelievo €${eurAmount.toFixed(2)} → IBAN`,
    });

    revalidatePath("/merchant/clearing");
    revalidatePath("/merchant");

    return { success: true, clearingId: clearing!.id, eurAmount, tokenAmount };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
