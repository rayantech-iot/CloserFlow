import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { data: configs } = await supabase
      .from("sheets_config")
      .select("*")
      .eq("sync_enabled", true);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ error: "Aucun sheet configuré" }, { status: 400 });
    }

    const order: any = {
      client_name: body.client_name || body.customer_name || body.name || "Client",
      phone: body.phone || body.telephone || "",
      city: body.city || body.ville || "",
      address: body.address || body.adresse || "",
      product: body.product || body.produit || body.article || "",
      quantity: parseInt(body.quantity || body.quantite || "1"),
      price: parseFloat(body.price || body.prix || body.montant || "0"),
      comments: body.comments || body.commentaire || body.notes || "",
      order_date: body.order_date || body.date || new Date().toISOString(),
      country: body.country || body.pays || configs[0]?.country || "",
      status: "nouvelle",
      source: `EasySell Webhook`,
    };

    const { error } = await supabase.from("orders").insert(order);
    if (error) throw error;

    return NextResponse.json({ success: true, order: order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
