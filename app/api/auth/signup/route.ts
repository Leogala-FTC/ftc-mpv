import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = getSupabaseRoute();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = body.name || "Utente";

  await supabase.from("profiles").upsert({ id: user.id, role: "user", name });
  await supabase.from("user_wallets").upsert({ user_id: user.id, balance_tokens: 0 });

  return NextResponse.json({ ok: true });
}
