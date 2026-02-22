import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase-server";
import { SUPPORTED_AMOUNTS_EUR } from "@/lib/constants";

export async function POST(req: Request) {
  const supabase = getSupabaseRoute();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { merchantId, amountEur } = await req.json();
  if (!SUPPORTED_AMOUNTS_EUR.includes(Number(amountEur) as any)) {
    return NextResponse.json({ error: "Fuori FTC" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_payment_session", {
    p_merchant_id: merchantId,
    p_amount_eur: amountEur,
    p_created_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
