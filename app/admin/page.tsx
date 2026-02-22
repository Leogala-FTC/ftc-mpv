import { getSupabaseServer } from "@/lib/supabase-server";

export default async function AdminHome() {
  const supabase = getSupabaseServer();
  const [{ count: users }, { count: merchants }, { count: paid }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
    supabase.from("merchants").select("*", { count: "exact", head: true }),
    supabase.from("payment_sessions").select("*", { count: "exact", head: true }).eq("status", "paid"),
  ]);
  return <div className="card"><h1 className="text-2xl font-bold">Admin KPI</h1><p>Utenti: {users ?? 0}</p><p>Merchant: {merchants ?? 0}</p><p>Pagamenti: {paid ?? 0}</p></div>;
}
