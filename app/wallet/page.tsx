import { requireUser } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase-server";

export default async function WalletPage() {
  const { user } = await requireUser();
  const supabase = getSupabaseServer();
  const { data: wallet } = await supabase.from("user_wallets").select("balance_tokens").eq("user_id", user.id).single();
  const { data: tx } = await supabase.from("token_transactions").select("id,type,amount_tokens,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <div className="card">Saldo: <b>{wallet?.balance_tokens ?? 0} T</b></div>
      <div className="card">
        <h2 className="font-semibold">Transazioni</h2>
        <ul className="mt-2 space-y-1 text-sm">{tx?.map((t) => <li key={t.id}>{t.type} · {t.amount_tokens}T</li>)}</ul>
      </div>
    </div>
  );
}
