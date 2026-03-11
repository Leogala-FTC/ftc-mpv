"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createClearingRequest(eurAmount: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Non autenticato" };

    // Controlla saldo EUR del merchant
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id,eur_balance")
      .eq("profile_user_id", user.id)
      .single();

    if (walletError || !wallet) return { success: false, error: "Wallet non trovato" };

    const currentEur = Number(wallet.eur_balance) || 0;
    if (currentEur < eurAmount) return { success: false, error: "Saldo insufficiente" };

    // Recupera IBAN dal profilo
    const { data: profile } = await supabase
      .from("profiles")
      .select("iban")
      .eq("user_id", user.id)
      .single();

    // Inserisce richiesta di clearing
    const { data: clearing, error: clearingError } = await supabase
      .from("clearing_requests")
      .insert({
        merchant_user_id: user.id,
        token_amount: 0,
        eur_amount: eurAmount,
        iban: profile?.iban ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (clearingError) return { success: false, error: clearingError.message };

    // Scala il saldo EUR (messo in "pending" finché non viene pagato)
    await supabase
      .from("wallets")
      .update({ eur_balance: currentEur - eurAmount })
      .eq("id", wallet.id);

    revalidatePath("/merchant/clearing");
    revalidatePath("/merchant");

    return { success: true, clearingId: clearing!.id, eurAmount };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
