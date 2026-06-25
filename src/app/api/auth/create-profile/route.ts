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
      .select("id, organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (existing?.organization_id) {
      return NextResponse.json({ success: true });
    }

    // Créer une organisation pour le nouvel utilisateur
    const slug = "org-" + userId.replace(/-/g, "").slice(0, 12);
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: `Boutique de ${name}`, slug })
      .select("id")
      .single();

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }

    if (existing) {
      // Profil existe déjà (sans org) → mettre à jour
      await supabase.from("profiles").update({
        role: "admin",
        organization_id: org.id,
      }).eq("id", userId);
    } else {
      // Nouveau profil
      await supabase.from("profiles").insert({
        id: userId,
        email,
        display_name: name,
        role: "admin",
        active: true,
        country: "",
        organization_id: org.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
