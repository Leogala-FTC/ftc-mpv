import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const supabase = getSupabaseRoute();
  const merchantId = new URL(req.url).searchParams.get("merchantId");
  if (!merchantId) return NextResponse.json({ error: "merchantId richiesto" }, { status: 400 });
  const [{ data: wallet }, { data: settings }, { data: requests }] = await Promise.all([
    supabase.from("merchant_wallets").select("available_tokens,pending_tokens").eq("merchant_id", merchantId).single(),
    supabase.from("app_settings").select("token_eur_rate_estimate").eq("id", 1).single(),
    supabase.from("clearing_requests").select("id,status,requested_tokens,eur_estimate,created_at").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(20),
  ]);
  return NextResponse.json({ ...wallet, rate: settings?.token_eur_rate_estimate ?? 0.02, requests: requests ?? [] });
}

export async function POST(req: Request) {
  const supabase = getSupabaseRoute();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { merchantId, requestedTokens } = await req.json();
  const { data, error } = await supabase.rpc("request_clearing", {
    p_merchant_id: merchantId,
    p_requested_tokens: requestedTokens,
    p_requested_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
