import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase-server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseRoute();

  const { data: row, error } = await supabase
    .from("clearing_requests")
    .select("id,merchant_id,requested_tokens,eur_estimate,status,created_at,approved_at,paid_at")
    .eq("id", id)
    .single();

  if (error || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));

  doc.fontSize(18).text("FTC Clearing Report", { underline: true });
  doc.moveDown();
  doc.fontSize(12);
  doc.text(`Richiesta: ${row.id}`);
  doc.text(`Merchant: ${row.merchant_id}`);
  doc.text(`Token: ${row.requested_tokens}`);
  doc.text(`Stima Euro: €${row.eur_estimate}`);
  doc.text(`Stato: ${row.status}`);
  doc.text(`Creato: ${row.created_at}`);
  if (row.approved_at) doc.text(`Approvato: ${row.approved_at}`);
  if (row.paid_at) doc.text(`Pagato: ${row.paid_at}`);
  doc.text("Documento non fiscale");
  doc.end();

  await new Promise((resolve) => doc.on("end", resolve));
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=clearing-${id}.pdf`,
    },
  });
}
