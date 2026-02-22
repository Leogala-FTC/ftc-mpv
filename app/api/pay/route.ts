import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = getSupabaseRoute();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, action } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Sessione mancante" }, { status: 400 });

  if (action === "preview") {
    const { data, error } = await supabase.from("payment_sessions").select("id,amount_tokens,status,expires_at").eq("id", sessionId).single();
    if (error || !data) return NextResponse.json({ error: "Sessione non trovata" }, { status: 404 });
    if (data.status !== "pending") return NextResponse.json({ error: "Sessione non valida" }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.rpc("confirm_payment", { p_session_id: sessionId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(data);
}
