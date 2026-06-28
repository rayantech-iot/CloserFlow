import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  const supabase = createClient(supabaseUrl || "", serviceRoleKey || "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { userId, email, displayName } = await request.json();
    if (!userId || !email) {
      return NextResponse.json({ error: "userId et email requis" }, { status: 400 });
    }

    const name = displayName || email.split("@")[0] || "Utilisateur";

    // Vérifier si l'utilisateur a déjà un profil
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true });
    }

    // Nouveau profil (admin par défaut)
    await supabase.from("profiles").insert({
      id: userId,
      email,
      display_name: name,
      role: "admin",
      active: true,
      country: "",
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
