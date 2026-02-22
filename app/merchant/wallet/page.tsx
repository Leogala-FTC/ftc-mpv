import { MERCHANT_1_ID } from "@/lib/constants";
import { getSupabaseServer } from "@/lib/supabase-server";

export default async function MerchantWalletPage() {
  const supabase = getSupabaseServer();
  const { data: wallet } = await supabase.from("merchant_wallets").select("available_tokens,pending_tokens").eq("merchant_id", MERCHANT_1_ID).single();
  const { data: tx } = await supabase.from("token_transactions").select("id,amount_tokens,created_at").eq("merchant_id", MERCHANT_1_ID).order("created_at", { ascending: false }).limit(20);

  return <div className="space-y-3"><h1 className="text-2xl font-bold">Wallet Merchant</h1><div className="card">Disponibili: {wallet?.available_tokens ?? 0}T<br/>Pending: {wallet?.pending_tokens ?? 0}T</div><div className="card">{tx?.map((t) => <p key={t.id}>{t.amount_tokens}T</p>)}</div></div>;
}
