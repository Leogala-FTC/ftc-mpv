import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, TOPUP_PACKAGES } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { packageIndex } = await req.json();
    const pkg = TOPUP_PACKAGES[packageIndex as number];
    if (!pkg) return NextResponse.json({ error: "Pacchetto non valido" }, { status: 400 });

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

    // Crea o recupera stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name, alias")
      .eq("user_id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name ?? profile?.alias ?? undefined,
        metadata: { ftc_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `FTC Token Pack — ${pkg.label}`,
              description: `${pkg.tokens} token · Tasso: 11.7 token/€`,
            },
            unit_amount: pkg.eur * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        ftc_user_id: user.id,
        tokens: String(pkg.tokens),
        eur: String(pkg.eur),
        type: "topup",
      },
      success_url: `${baseUrl}/user/topup?success=1&tokens=${pkg.tokens}`,
      cancel_url: `${baseUrl}/user/topup?cancelled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe topup error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
