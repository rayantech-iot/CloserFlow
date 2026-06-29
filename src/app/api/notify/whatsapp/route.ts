import { NextResponse } from "next/server";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const WHATSAPP_GROUP_ID = process.env.WHATSAPP_GROUP_ID || "";

export async function POST(request: Request) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return NextResponse.json(
      { error: "WhatsApp non configuré. Ajoutez WHATSAPP_TOKEN et WHATSAPP_PHONE_ID dans .env.local" },
      { status: 400 }
    );
  }

  try {
    const { to, message } = await request.json();
    if (!message) return NextResponse.json({ error: "Message requis" }, { status: 400 });

    const recipients = to ? [to] : WHATSAPP_GROUP_ID ? [WHATSAPP_GROUP_ID] : [];
    if (recipients.length === 0) {
      return NextResponse.json({ error: "Aucun destinataire configuré" }, { status: 400 });
    }

    const results = [];
    for (const recipient of recipients) {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: recipient,
            type: "text",
            text: { body: message.substring(0, 4096) },
          }),
        }
      );
      const data = await res.json();
      results.push({ recipient, ok: res.ok, data });
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
