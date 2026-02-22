import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase-server";

export async function GET() {
  const supabase = getSupabaseRoute();
  const { data } = await supabase.from("clearing_requests").select("id,merchant_id,requested_tokens,eur_estimate,status,created_at").in("status", ["pending", "approved", "paid"]).order("created_at", { ascending: false });
  return NextResponse.json(data ?? []);
}
