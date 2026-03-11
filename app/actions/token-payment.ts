"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { TOKENS_PER_EURO, TOKEN_FEE_RATE } from "@/lib/stripe";

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Merchant crea una sessione di pagamento in token */
export async function createTokenPaymentSession(amountEur: number, note?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  // Calcolo token
  // Merchant riceve: amountEur in token = floor(amountEur * 11.7)
  // FTC fee: 3% dei token totali a carico dell'utente
  // Utente paga: merchantTokens + feeTokens
  const tokenAmount = Math.floor(amountEur * TOKENS_PER_EURO);       // token al merchant
  const feeTokens = Math.ceil(tokenAmount * TOKEN_FEE_RATE);          // 3% fee FTC
  const totalTokens = tokenAmount + feeTokens;                         // totale a carico utente

  const db = getDb();
  const { data: session, error } = await db
    .from("token_payment_sessions")
    .insert({
      merchant_user_id: user.id,
      amount_eur: amountEur,
      token_amount: tokenAmount,
      fee_tokens: feeTokens,
      total_tokens: totalTokens,
      note: note ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  return { success: true, sessionId: session!.id, tokenAmount, feeTokens, totalTokens };
}

/** Recupera i dettagli di una sessione (per la pagina di pagamento utente) */
export async function getTokenPaymentSession(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const db = getDb();
  const { data: session, error } = await db
    .from("token_payment_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !session) return { success: false, error: "Sessione non trovata" };
  if (session.status !== "pending") return { success: false, error: "Sessione già completata o scaduta" };

  // Controlla scadenza
  if (new Date(session.expires_at) < new Date()) {
    await db.from("token_payment_sessions").update({ status: "expired" }).eq("id", sessionId);
    return { success: false, error: "Sessione scaduta" };
  }

  // Recupera nome merchant
  const { data: merchantProfile } = await db
    .from("profiles")
    .select("business_name, full_name")
    .eq("user_id", session.merchant_user_id)
    .single();

  // Saldo token utente
  const { data: wallet } = await db
    .from("wallets")
    .select("token_balance")
    .eq("profile_user_id", user.id)
    .single();

  return {
    success: true,
    session: {
      ...session,
      merchantName: merchantProfile?.business_name ?? merchantProfile?.full_name ?? "Merchant",
    },
    userTokenBalance: wallet?.token_balance ?? 0,
  };
}

/** Utente conferma il pagamento in token */
export async function confirmTokenPayment(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const db = getDb();

  // Lock: aggiorna status atomicamente
  const { data: session, error: fetchError } = await db
    .from("token_payment_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("status", "pending")
    .single();

  if (fetchError || !session) return { success: false, error: "Sessione non disponibile" };
  if (new Date(session.expires_at) < new Date()) return { success: false, error: "Sessione scaduta" };

  // Controlla saldo utente
  const { data: buyerWallet } = await db
    .from("wallets")
    .select("id, token_balance")
    .eq("profile_user_id", user.id)
    .single();

  if (!buyerWallet || buyerWallet.token_balance < session.total_tokens) {
    return { success: false, error: `Saldo insufficiente. Ti servono ${session.total_tokens} token, hai ${buyerWallet?.token_balance ?? 0}.` };
  }

  // Marca sessione come completed
  await db.from("token_payment_sessions")
    .update({ status: "completed", buyer_user_id: user.id })
    .eq("id", sessionId);

  // Scala token dal buyer
  await db.from("wallets")
    .update({ token_balance: buyerWallet.token_balance - session.total_tokens })
    .eq("id", buyerWallet.id);

  // Accredita token al merchant
  const { data: merchantWallet } = await db
    .from("wallets")
    .select("id, token_balance")
    .eq("profile_user_id", session.merchant_user_id)
    .single();

  if (merchantWallet) {
    await db.from("wallets")
      .update({ token_balance: merchantWallet.token_balance + session.token_amount })
      .eq("id", merchantWallet.id);
  } else {
    await db.from("wallets").insert({
      profile_user_id: session.merchant_user_id,
      token_balance: session.token_amount,
      eur_balance: 0,
    });
  }

  // Registra transazioni
  await db.from("token_transactions").insert([
    {
      profile_user_id: user.id,
      direction: "out",
      amount_tokens: session.total_tokens,
      reason: `Pagamento token €${Number(session.amount_eur).toFixed(2)} + 3% fee`,
    },
    {
      profile_user_id: session.merchant_user_id,
      direction: "in",
      amount_tokens: session.token_amount,
      reason: `Incasso token da cliente — €${Number(session.amount_eur).toFixed(2)}`,
    },
  ]);

  revalidatePath("/user/wallet");
  revalidatePath("/merchant");

  return { success: true, tokensSpent: session.total_tokens, amountEur: session.amount_eur };
}
