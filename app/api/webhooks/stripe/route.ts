import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe, STRIPE_WEBHOOK_SECRET, TOKENS_PER_EURO, TOKEN_FEE_RATE } from "@/lib/stripe";
import Stripe from "stripe";

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getDb();

  // ─── 1. RICARICA TOKEN (Checkout session completata) ─────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.type === "topup") {
      const userId = session.metadata.ftc_user_id;
      const tokens = parseInt(session.metadata.tokens);
      const eur = parseFloat(session.metadata.eur);

      await creditTokens(db, userId, tokens, `Ricarica €${eur} — ${tokens} token`);
    }
  }

  // ─── 2. PAGAMENTO POS STRIPE TERMINAL (payment_intent succeeded) ─────────
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;

    // Solo pagamenti con metadata FTC (POS con carta collegata)
    const ftcBuyerCustomerId = pi.metadata?.ftc_customer_id;
    const merchantConnectId = (event as Stripe.Event & { account?: string }).account;

    if (!ftcBuyerCustomerId || !merchantConnectId) {
      return NextResponse.json({ received: true });
    }

    const amountEur = pi.amount / 100;

    // Trova utente FTC dal stripe_customer_id
    const { data: buyerProfile } = await db
      .from("profiles")
      .select("user_id")
      .eq("stripe_customer_id", ftcBuyerCustomerId)
      .single();

    // Trova merchant FTC dal stripe_connect_account_id
    const { data: merchantProfile } = await db
      .from("profiles")
      .select("user_id")
      .eq("stripe_connect_account_id", merchantConnectId)
      .single();

    if (!buyerProfile || !merchantProfile) {
      console.error("FTC: utente o merchant non trovato per pagamento POS", { ftcBuyerCustomerId, merchantConnectId });
      return NextResponse.json({ received: true });
    }

    const cashbackPercent = 5; // default, in futuro recuperabile dal profilo merchant
    const ftcFee = amountEur * 0.05;
    const cashbackEur = amountEur * (cashbackPercent / 100);
    const merchantEur = amountEur - ftcFee - cashbackEur;
    const cashbackTokens = Math.floor(cashbackEur * TOKENS_PER_EURO);

    // Inserisce pagamento
    const { data: payment } = await db.from("payments").insert({
      merchant_user_id: merchantProfile.user_id,
      buyer_user_id: buyerProfile.user_id,
      amount_eur: amountEur,
      fee_eur: ftcFee,
      cashback_tokens: cashbackTokens,
      cashback_percent: cashbackPercent,
      status: "completed",
      note: `POS Stripe — PI: ${pi.id}`,
    }).select("id").single();

    // Accredita EUR al merchant
    await creditEur(db, merchantProfile.user_id, merchantEur, payment?.id);
    // Accredita token cashback al buyer
    await creditTokens(db, buyerProfile.user_id, cashbackTokens,
      `Cashback ${cashbackPercent}% su €${amountEur.toFixed(2)}`, payment?.id);
  }

  return NextResponse.json({ received: true });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function creditTokens(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  tokens: number,
  reason: string,
  paymentId?: string
) {
  const { data: wallet } = await db
    .from("wallets").select("id,token_balance").eq("profile_user_id", userId).single();

  if (wallet) {
    await db.from("wallets")
      .update({ token_balance: wallet.token_balance + tokens }).eq("id", wallet.id);
  } else {
    await db.from("wallets").insert({ profile_user_id: userId, token_balance: tokens, eur_balance: 0 });
  }

  await db.from("token_transactions").insert({
    profile_user_id: userId,
    payment_id: paymentId ?? null,
    direction: "in",
    amount_tokens: tokens,
    reason,
  });
}

async function creditEur(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  amount: number,
  paymentId?: string
) {
  const { data: wallet } = await db
    .from("wallets").select("id,eur_balance").eq("profile_user_id", userId).single();

  if (wallet) {
    await db.from("wallets")
      .update({ eur_balance: (Number(wallet.eur_balance) || 0) + amount }).eq("id", wallet.id);
  } else {
    await db.from("wallets").insert({ profile_user_id: userId, token_balance: 0, eur_balance: amount });
  }

  // Registra anche come nota nel payments
  if (paymentId) {
    await db.from("payments").update({ status: "completed" }).eq("id", paymentId);
  }
}
