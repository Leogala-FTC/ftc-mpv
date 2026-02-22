import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function requireUser() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase.from("profiles").select("id, role, name").eq("id", user.id).single();
  return { user, profile };
}
