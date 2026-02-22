import { getSupabaseServer } from "@/lib/supabase-server";

export default async function AdminMerchants() {
  const supabase = getSupabaseServer();
  const { data } = await supabase.from("merchants").select("id,name,status,created_at");
  return <div className="card"><h1 className="text-2xl font-bold">Merchants</h1>{data?.map((m) => <p key={m.id}>{m.name} · {m.status}</p>)}</div>;
}
