import Link from "next/link";
import { AppNav } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase-server";

export default async function HomePage() {
  const { user } = await requireUser();
  const supabase = getSupabaseServer();
  const { data: wallet } = await supabase.from("user_wallets").select("balance_tokens").eq("user_id", user.id).single();

  return (
    <div>
      <AppNav links={[{ href: "/home", label: "Home" }, { href: "/wallet", label: "Wallet" }, { href: "/profile", label: "Profilo" }]} />
      <div className="card space-y-2">
        <h1 className="text-2xl font-bold">Saldo Token</h1>
        <p className="text-3xl font-extrabold text-ftc-viola">{wallet?.balance_tokens ?? 0} T</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/pay" className="btn-primary text-center">Paga</Link>
        <Link href="/topup" className="btn-secondary text-center">Top-up</Link>
      </div>
    </div>
  );
}
