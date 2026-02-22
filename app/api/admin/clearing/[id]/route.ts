import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase-server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseRoute();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { action } = await req.json();

  const map: Record<string, string> = { approve: "approve_clearing", reject: "reject_clearing", paid: "mark_clearing_paid" };
  const fn = map[action];
  if (!fn) return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  const { error } = await supabase.rpc(fn, { p_request_id: id, p_admin_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
