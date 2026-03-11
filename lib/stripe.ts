import Stripe from "stripe";

// Singleton Stripe client — server only
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY non configurata");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const STRIPE_TOPUP_WEBHOOK_SECRET = process.env.STRIPE_TOPUP_WEBHOOK_SECRET ?? "";

// Pacchetti ricarica token
export const TOPUP_PACKAGES = [
  { eur: 20,  tokens: 234,  label: "Starter",  description: "234 token · €20" },
  { eur: 30,  tokens: 351,  label: "Base",      description: "351 token · €30" },
  { eur: 40,  tokens: 468,  label: "Plus",      description: "468 token · €40" },
  { eur: 50,  tokens: 585,  label: "Premium",   description: "585 token · €50" },
] as const;

export const TOKENS_PER_EURO = 11.7;
export const TOKEN_FEE_RATE = 0.03; // 3% su pagamenti in token
