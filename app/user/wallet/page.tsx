import { createClient } from "@/lib/supabase/server";

export default async function WalletPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Login richiesto</div>;
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("token_balance")
    .eq("profile_user_id", user.id)
    .single();

  const { data: transactions } = await supabase
    .from("token_transactions")
    .select("*")
    .eq("profile_user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div style={{ padding: 20 }}>
      <h1>Wallet</h1>

      <h2>Saldo</h2>
      <p>{wallet?.token_balance ?? 0} token</p>

      <h2>Movimenti</h2>

      {transactions?.map((t) => (
        <div key={t.id}>
          <p>{t.reason}</p>
          <p>
            {t.direction === "in" ? "+" : "-"}
            {t.amount_tokens} token
          </p>
        </div>
      ))}
    </div>
  );
}
