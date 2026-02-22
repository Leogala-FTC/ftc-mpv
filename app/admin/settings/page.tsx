import { getSupabaseServer } from "@/lib/supabase-server";

export default async function AdminSettings() {
  const supabase = getSupabaseServer();
  const { data: settings } = await supabase.from("app_settings").select("token_eur_rate_estimate,session_ttl_seconds").eq("id", 1).single();
  const { data: packs } = await supabase.from("topup_packs").select("name,tokens,is_active").order("sort_order");
  const { data: pricing } = await supabase.from("merchant_pricing").select("amount_eur,cost_tokens").eq("merchant_id", "00000000-0000-0000-0000-000000000001").order("amount_eur");
  return <div className="space-y-3"><div className="card"><h1 className="text-2xl font-bold">Settings</h1><p>TTL: {settings?.session_ttl_seconds}s</p><p>Rate stima: {settings?.token_eur_rate_estimate}</p></div><div className="card"><h2 className="font-semibold">Packs</h2>{packs?.map((p) => <p key={p.name}>{p.name}: {p.tokens}T</p>)}</div><div className="card"><h2 className="font-semibold">Pricing Merchant 1</h2>{pricing?.map((p) => <p key={p.amount_eur}>{p.amount_eur}€ → {p.cost_tokens}T</p>)}</div></div>;
}
