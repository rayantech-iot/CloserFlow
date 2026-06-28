import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getAdminClient = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

async function deleteAll(supabaseAdmin: any, table: string) {
  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  return error;
}

export async function POST(request: Request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || "admin@closerflow.com";
    const password = body.password || "CloserFlow@2026!";
    const displayName = body.displayName || "Admin";

    const tables = ["order_history", "order_notes", "orders", "sheets_config", "audit_logs", "teams", "profiles"];
    const errors: string[] = [];

    for (const table of tables) {
      const err = await deleteAll(supabaseAdmin, table);
      if (err) errors.push(table + ": " + err.message);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Erreurs lors du nettoyage", details: errors }, { status: 500 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });

    if (authError || !authData?.user) {
      return NextResponse.json({ error: authError?.message || "Erreur création utilisateur" }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authData.user.id,
      email,
      display_name: displayName,
      role: "admin",
      active: true,
      country: "",
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Base de données réinitialisée avec succès",
      credentials: { email, password },
      userId: authData.user.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
