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

  const tokenAmount = Math.floor(amountEur * TOKENS_PER_EURO);
  const feeTokens = Math.ceil(tokenAmount * TOKEN_FEE_RATE);
  const totalTokens = tokenAmount + feeTokens;

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

/** Recupera i dettagli di una sessione */
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

  if (session.status === "completed") return { success: false, error: "Sessione già pagata" };
  if (session.status === "expired") return { success: false, error: "Sessione scaduta" };

  if (new Date(session.expires_at) < new Date()) {
    await db.from("token_payment_sessions").update({ status: "expired" }).eq("id", sessionId);
    return { success: false, error: "Sessione scaduta" };
  }

  const { data: merchantProfile } = await db
    .from("profiles")
    .select("business_name, full_name")
    .eq("user_id", session.merchant_user_id)
    .single();

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

/** Controlla status sessione (polling merchant) */
export async function checkSessionStatus(sessionId: string) {
  const db = getDb();
  const { data: session } = await db
    .from("token_payment_sessions")
    .select("status, buyer_user_id, total_tokens, amount_eur")
    .eq("id", sessionId)
    .single();

  if (!session) return { status: "not_found" };
  return {
    status: session.status,
    totalTokens: session.total_tokens,
    amountEur: session.amount_eur,
  };
}

/** Utente conferma il pagamento in token — ordine corretto: wallet prima, sessione dopo */
export async function confirmTokenPayment(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non autenticato" };

  const db = getDb();

  // 1. Recupera sessione — deve essere pending e non scaduta
  const { data: session, error: fetchError } = await db
    .from("token_payment_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("status", "pending")
    .single();

  if (fetchError || !session) return { success: false, error: "Sessione non disponibile o già elaborata" };
  if (new Date(session.expires_at) < new Date()) {
    await db.from("token_payment_sessions").update({ status: "expired" }).eq("id", sessionId);
    return { success: false, error: "Sessione scaduta" };
  }

  // 2. Controlla saldo buyer
  const { data: buyerWallet, error: walletError } = await db
    .from("wallets")
    .select("id, token_balance")
    .eq("profile_user_id", user.id)
    .single();

  if (walletError || !buyerWallet) {
    return { success: false, error: "Wallet non trovato. Ricarica prima i tuoi token." };
  }
  if (buyerWallet.token_balance < session.total_tokens) {
    return { success: false, error: `Saldo insufficiente. Ti servono ${session.total_tokens} token, hai ${buyerWallet.token_balance}.` };
  }

  // 3. Scala token dal buyer
  const { error: buyerUpdateError } = await db
    .from("wallets")
    .update({ token_balance: buyerWallet.token_balance - session.total_tokens })
    .eq("id", buyerWallet.id);

  if (buyerUpdateError) return { success: false, error: "Errore scalando i token: " + buyerUpdateError.message };

  // 4. Accredita token al merchant (upsert sicuro)
  const { data: merchantWallet } = await db
    .from("wallets")
    .select("id, token_balance")
    .eq("profile_user_id", session.merchant_user_id)
    .single();

  if (merchantWallet) {
    const { error: merchantUpdateError } = await db
      .from("wallets")
      .update({ token_balance: merchantWallet.token_balance + session.token_amount })
      .eq("id", merchantWallet.id);

    if (merchantUpdateError) {
      // Rollback buyer wallet
      await db.from("wallets").update({ token_balance: buyerWallet.token_balance }).eq("id", buyerWallet.id);
      return { success: false, error: "Errore accreditando i token al merchant" };
    }
  } else {
    // Il merchant non ha wallet: crealo. Se già esiste (race condition) ignora il conflitto
    const { error: insertError } = await db.from("wallets").upsert({
      profile_user_id: session.merchant_user_id,
      token_balance: session.token_amount,
    }, { onConflict: "profile_user_id", ignoreDuplicates: false });

    if (insertError) {
      await db.from("wallets").update({ token_balance: buyerWallet.token_balance }).eq("id", buyerWallet.id);
      return { success: false, error: "Errore creando wallet merchant: " + insertError.message };
    }
  }

  // 5. Accredita fee tokens al wallet della piattaforma FTC
  const { data: platformWallet } = await db.from("platform_wallet").select("token_balance").eq("id", 1).single();
  if (platformWallet) {
    await db.from("platform_wallet").update({
      token_balance: Number(platformWallet.token_balance) + session.fee_tokens,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
  }

  // 6. Registra transazioni
  await db.from("token_transactions").insert([
    {
      profile_user_id: user.id,
      direction: "out",
      amount_tokens: session.total_tokens,
      reason: `Pagamento token a ${session.merchant_user_id} — €${Number(session.amount_eur).toFixed(2)}`,
    },
    {
      profile_user_id: session.merchant_user_id,
      direction: "in",
      amount_tokens: session.token_amount,
      reason: `Incasso token da cliente — €${Number(session.amount_eur).toFixed(2)}`,
    },
  ]);

  // 7. Marca sessione completed — SOLO dopo che tutto è andato a buon fine
  await db
    .from("token_payment_sessions")
    .update({ status: "completed", buyer_user_id: user.id })
    .eq("id", sessionId);

  revalidatePath("/user/wallet");
  revalidatePath("/merchant");

  return { success: true, tokensSpent: session.total_tokens, amountEur: session.amount_eur };
}
