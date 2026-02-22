import { getSupabaseServer } from "@/lib/supabase-server";

export default async function AdminUsers() {
  const supabase = getSupabaseServer();
  const { data } = await supabase.from("profiles").select("id,name,role,created_at").order("created_at", { ascending: false }).limit(100);
  return <div className="card"><h1 className="text-2xl font-bold">Users</h1>{data?.map((u) => <p key={u.id}>{u.name} · {u.role}</p>)}</div>;
}
