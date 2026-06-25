import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { email, password, displayName, organizationName } = await request.json();

    if (!email || !password || !displayName || !organizationName) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Le mot de passe doit faire au moins 6 caractères" }, { status: 400 });
    }

    // 1. Créer l'utilisateur auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message?.includes("already")) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authUser.user.id;

    // 2. Créer l'organisation
    const slug = slugify(organizationName);
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: organizationName, slug })
      .select()
      .single();

    if (orgError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Erreur création organisation: ${orgError.message}` }, { status: 400 });
    }

    // 3. Créer le profil (admin de l'org)
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      email,
      display_name: displayName,
      role: "admin",
      organization_id: org.id,
      phone: "",
      country: "",
      active: true,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      await supabase.from("organizations").delete().eq("id", org.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      organizationId: org.id,
      message: "Compte créé avec succès. Vous êtes maintenant administrateur de votre organisation.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
