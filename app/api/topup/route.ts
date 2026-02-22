import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase-server";

export async function GET() {
  const supabase = getSupabaseRoute();
  const { data } = await supabase.from("topup_packs").select("id,name,tokens").eq("is_active", true).order("sort_order");
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = getSupabaseRoute();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packId } = await req.json();
  const { error } = await supabase.rpc("topup", { p_user_id: user.id, p_pack_id: packId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
