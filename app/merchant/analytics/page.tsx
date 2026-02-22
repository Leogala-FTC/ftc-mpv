import { MERCHANT_1_ID } from "@/lib/constants";
import { getSupabaseServer } from "@/lib/supabase-server";

export default async function MerchantAnalyticsPage() {
  const supabase = getSupabaseServer();
  const { count } = await supabase.from("payment_sessions").select("*", { count: "exact", head: true }).eq("merchant_id", MERCHANT_1_ID).eq("status", "paid");
  const { data: volume } = await supabase.from("payment_sessions").select("amount_tokens").eq("merchant_id", MERCHANT_1_ID).eq("status", "paid");
  const total = (volume ?? []).reduce<number>((acc, row) => acc + Number(row.amount_tokens ?? 0), 0);
  return <div className="card"><h1 className="text-2xl font-bold">Analytics</h1><p>Pagamenti completati: {count ?? 0}</p><p>Volume token: {total}T</p></div>;
}
